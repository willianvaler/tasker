import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import type { Json } from '../database.types';
import { applyRep, effectiveReps, readRepeatPlan } from '../repeat';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, runCommand, sessionUserId } from '../sync/local';
import { uuidv7 } from '../uuid';
import { completionSummarySchema, type CompletionSummary } from './game';
import { keys, taskMutationKey } from './keys';
import { isReceivedTask, localCycleKey } from './shares';
import { deleteLastLocalSet, insertLocalSet, type SetValues } from './workout-sets';
import { estimateCompletionXp } from '../sync/pending-xp';
import {
  invalidateWhenIdle,
  localTaskForXp,
  patchTaskLists,
  pendingSummary,
  restore,
  snapshot,
  type Task,
} from './tasks';

// Séries feitas (J1, D123): a conta é do usuário (task_progress) e só o log_rep muda. Concluir
// no total é efeito do servidor; aqui a tela só antecipa.

/** Séries guardadas por tarefa: { [taskId]: n }. Só JSON (o cache vai para o disco). */
export type ProgressMap = Record<string, number>;

export function useMyProgress() {
  return useQuery({
    queryKey: keys.progress,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<ProgressMap> => {
      const userId = await sessionUserId();
      if (!userId) return {};
      const rows = isLocal()
        ? await db.getAll<{ task_id: string; done_reps: number }>(
            'select task_id, done_reps from task_progress where user_id = ?',
            [userId],
          )
        : await supabase
            .from('task_progress')
            .select('task_id, done_reps')
            .eq('user_id', userId)
            .then(({ data, error }) => {
              if (error) throw error;
              return data;
            });
      return Object.fromEntries(rows.map((r) => [r.task_id, r.done_reps]));
    },
  });
}

export const logRepKey = [...taskMutationKey, 'rep'] as const;
/** `id`: chave do comando, gerada aqui, para o reenvio da fila não contar duas vezes */
export type LogRepVars = {
  task: Task;
  delta: 1 | -1;
  id: string;
  values?: Record<string, unknown>;
};

const repResultSchema = z
  .object({ done_reps: z.number(), total: z.number(), completed: z.boolean() })
  .partial();
export type RepResult = { reps: number; completed: boolean; summary: CompletionSummary | null };

export async function logRepFn({ task, delta, id, values }: LogRepVars): Promise<RepResult | null> {
  const plan = readRepeatPlan(task.repeat_plan);
  if (!plan) return null;
  // A série que conta leva o id do comando: o diário local e o do servidor são a mesma linha
  const setValues = delta === 1 ? { ...(values ?? {}), set_id: id } : (values ?? null);
  const args = { p_task_id: task.id, p_delta: delta, p_values: setValues };
  let result: unknown;
  let estimate = 0;
  if (isLocal()) {
    const userId = await sessionUserId();
    // XP só na série que conclui (J6): é ela que vira pendente sem resposta do servidor
    const before = await db.getOptional<{ status: string; done_reps: number | null }>(
      `select t.status, p.done_reps from tasks t
       left join task_progress p on p.task_id = t.id and p.user_id = ? where t.id = ?`,
      [userId, task.id],
    );
    const share = await isReceivedTask(task.id);
    const received = share ? { key: await localCycleKey(share.pageId, task.recurrence) } : null;
    const concludes =
      !received &&
      !!before &&
      before.status !== 'done' &&
      applyRep(plan, false, before.done_reps, delta).done;
    const xpTask = concludes ? await localTaskForXp(task.id) : null;
    estimate = xpTask ? estimateCompletionXp(xpTask) : 0;
    result = await runCommand(
      'log_rep',
      args,
      async (tx) => {
        // Pela transação: o `db` esperaria esta mesma transação terminar
        const row = await tx.getOptional<{ status: string; done_reps: number | null }>(
          `select t.status, p.done_reps from tasks t
         left join task_progress p on p.task_id = t.id and p.user_id = ? where t.id = ?`,
          [userId, task.id],
        );
        if (!row) return;
        // Página recebida (L2): o "feito" é o do aluno (o da lista já vem com ele)
        const doneBefore = received ? task.status === 'done' : row.status === 'done';
        const next = applyRep(plan, doneBefore, row.done_reps, delta);
        const now = new Date().toISOString();
        // As tabelas do PowerSync são views: sem "on conflict"
        // O diário (AC4): a série como aconteceu, ou some a última ao desfazer
        const current = effectiveReps(plan, doneBefore, row.done_reps);
        if (delta === 1 && next.reps > current)
          await insertLocalSet(tx, task, userId, id, (setValues ?? {}) as SetValues, next.reps);
        else if (delta === -1 && current > 0) await deleteLastLocalSet(tx, task.id, userId);
        if (row.done_reps == null)
          await tx.execute(
            `insert into task_progress (id, task_id, user_id, done_reps, logged_values, cycle_key, updated_at)
           values (?, ?, ?, ?, '[]', 'once', ?)`,
            [`${task.id}:${userId}`, task.id, userId, next.reps, now],
          );
        else
          await tx.execute(
            'update task_progress set done_reps = ?, updated_at = ? where task_id = ? and user_id = ?',
            [next.reps, now, task.id, userId],
          );
        if (next.done === doneBefore) return;
        if (received) {
          await tx.execute(
            'delete from share_checks where task_id = ? and user_id = ? and cycle_key = ?',
            [task.id, userId, received.key],
          );
          if (next.done)
            await tx.execute(
              `insert into share_checks (id, task_id, page_id, user_id, cycle_key, done_at)
               values (?, ?, ?, ?, ?, ?)`,
              [uuidv7(), task.id, task.page_id, userId, received.key, new Date().toISOString()],
            );
          return;
        }
        await tx.execute('update tasks set status = ?, completed_at = ? where id = ?', [
          next.done ? 'done' : 'todo',
          next.done ? new Date().toISOString() : null,
          task.id,
        ]);
      },
      estimate,
    );
  } else {
    // Mesmo online vai pelo run_once: o reenvio da fila do TanStack não conta duas vezes
    const { data, error } = await supabase.rpc('run_once', {
      p_key: id,
      p_name: 'log_rep',
      p_args: args as Json,
    });
    if (error) throw error;
    result = data;
  }
  if (result == null) {
    // Sem resposta (offline, lento): só a série que conclui mostra o XP estimado, como pendente
    if (estimate <= 0) return null;
    return { reps: plan.total, completed: true, summary: pendingSummary(estimate) };
  }
  const rep = repResultSchema.parse(result);
  return {
    reps: rep.done_reps ?? 0,
    completed: rep.completed ?? false,
    summary: completionSummarySchema.safeParse(result).data ?? null,
  };
}

function settle(queryClient: QueryClient) {
  invalidateWhenIdle(queryClient);
  queryClient.invalidateQueries({ queryKey: keys.progress });
  queryClient.invalidateQueries({ queryKey: keys.game });
  queryClient.invalidateQueries({ queryKey: keys.workoutSets });
}

/** Para a fila restaurada do disco depois de reabrir o app (ver registerOfflineTaskMutations). */
export function registerOfflineRepMutations(queryClient: QueryClient) {
  queryClient.setMutationDefaults(logRepKey, {
    scope: { id: 'tasks' },
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: (vars: LogRepVars) => logRepFn(vars),
    onSettled: () => settle(queryClient),
  });
}

/** Uma série feita (+1) ou desfeita (−1). A tela muda na hora; o servidor confirma. */
export function useLogRep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: logRepKey,
    scope: { id: 'tasks' },
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: logRepFn,
    onMutate: async ({ task, delta }) => {
      const plan = readRepeatPlan(task.repeat_plan);
      if (!plan) return {};
      const saved = await snapshot(queryClient);
      await queryClient.cancelQueries({ queryKey: keys.progress });
      const progress = queryClient.getQueryData<ProgressMap>(keys.progress);
      const next = applyRep(plan, task.status === 'done', progress?.[task.id], delta);
      queryClient.setQueryData<ProgressMap>(keys.progress, (map) => ({
        ...map,
        [task.id]: next.reps,
      }));
      patchTaskLists(queryClient, (t) =>
        t.id === task.id
          ? {
              ...t,
              status: next.done ? 'done' : t.status === 'done' ? 'todo' : t.status,
              completed_at: next.done ? (t.completed_at ?? new Date().toISOString()) : null,
            }
          : t,
      );
      return { saved, progress };
    },
    onError: (_err, _vars, context) => {
      restore(queryClient, context?.saved);
      if (context && 'progress' in context)
        queryClient.setQueryData(keys.progress, context.progress);
    },
    onSettled: () => settle(queryClient),
  });
}

export const newRepId = () => uuidv7();
