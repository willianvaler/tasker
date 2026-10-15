import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { uuidv7 } from '@/lib/uuid';

import type { Json, Tables } from '../db';
import type { ParsedTask } from '../parser/quick';
import { todayIn } from '../parser/dates';
import { asRecurrence, nextDueDate } from '../recurrence';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { gamificationConfig } from '../gamification.config';
import { estimateCompletionXp } from '../sync/pending-xp';
import {
  isLocal,
  localTasks,
  refreshCyclesInBackground,
  runCommand,
  sessionUserId,
  TASK_WITH_PAGE_SQL,
  toSqlValue,
  toTask,
  toTaskWithPage,
} from '../sync/local';
import { completionSummarySchema, type CompletionSummary } from './game';
import { isReceivedTask, localCycleKey, overlayReceived } from './shares';
import { keys, taskMutationKey } from './keys';
import { useTree, type Page, type Tree } from './tree';

export type Task = Tables<'tasks'>;
export type TaskWithPage = Task & {
  page: { name: string; icon: string | null; view_type?: string } | null;
};

const TASK_WITH_PAGE = '*, page:pages(name, icon, view_type)';

/** Todas as tarefas da página, inclusive subtarefas e concluídas. */
export function usePageTasks(pageId: string | undefined) {
  return useQuery({
    queryKey: keys.pageTasks(pageId ?? ''),
    enabled: !!pageId,
    queryFn: async () => {
      // Página recebida (L2): o "feito" é o do aluno, não o do autor
      if (isLocal()) {
        refreshCyclesInBackground(pageId);
        return overlayReceived(
          await localTasks('select * from tasks where page_id = ? order by position, created_at', [
            pageId,
          ]),
          pageId ?? '',
        );
      }
      // Reabre o que ficou em ciclo vencido antes de ler (o cron também faz, a cada 15 min)
      await supabase.rpc('refresh_cycles', { p_page_id: pageId ?? '' });
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('page_id', pageId ?? '')
        .order('position')
        .order('created_at');
      if (error) throw error;
      return overlayReceived(data, pageId ?? '');
    },
  });
}

/** Tarefas abertas com vencimento até hoje (atrasadas + de hoje), de todas as páginas. */
export function useTodayTasks(today: string) {
  return useQuery({
    queryKey: keys.today(today),
    queryFn: async () => {
      if (isLocal()) {
        refreshCyclesInBackground();
        const rows = await db.getAll<Record<string, unknown>>(
          `${TASK_WITH_PAGE_SQL} where t.parent_task_id is null and t.status != 'done'
             and t.due_date <= ? order by t.due_date, t.priority desc, t.position`,
          [today],
        );
        return rows.map(toTaskWithPage);
      }
      await supabase.rpc('refresh_cycles', {});
      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_WITH_PAGE)
        .is('parent_task_id', null)
        .neq('status', 'done')
        .lte('due_date', today)
        .order('due_date')
        .order('priority', { ascending: false })
        .order('position');
      if (error) throw error;
      return data as TaskWithPage[];
    },
  });
}

/** Abertas que vencem depois de hoje, até `until` (Início: próximos dias). */
export function useUpcomingTasks(today: string, until: string) {
  return useQuery({
    queryKey: ['tasks', 'upcoming', today, until],
    queryFn: async () => {
      if (isLocal()) {
        const rows = await db.getAll<Record<string, unknown>>(
          `${TASK_WITH_PAGE_SQL} where t.parent_task_id is null and t.status != 'done'
             and t.due_date > ? and t.due_date <= ?
           order by t.due_date, t.priority desc, t.position`,
          [today, until],
        );
        return rows.map(toTaskWithPage);
      }
      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_WITH_PAGE)
        .is('parent_task_id', null)
        .neq('status', 'done')
        .gt('due_date', today)
        .lte('due_date', until)
        .order('due_date')
        .order('priority', { ascending: false })
        .order('position');
      if (error) throw error;
      return data as TaskWithPage[];
    },
  });
}

export type HabitTask = Task & { page: { name: string; icon: string | null; view_type: string } };

/**
 * Hábitos de todas as páginas do tipo hábitos (a tela Hoje filtra os agendados para hoje).
 * Busca pelos ids das páginas (da árvore em cache), que usa o índice: filtrar só pelo tipo da página
 * fazia o banco checar a permissão de todas as tarefas da tabela, de todo mundo (~1 s com 18 mil).
 */
export function useHabits(today: string) {
  const tree = useTree();
  const pageIds = (tree.data?.pages ?? [])
    .filter((p) => p.view_type === 'habits')
    .map((p) => p.id)
    .sort();
  return useQuery({
    queryKey: [...keys.habits(today), pageIds.join(',')],
    enabled: !!tree.data,
    queryFn: async () => {
      if (pageIds.length === 0) return [];
      if (isLocal()) {
        refreshCyclesInBackground();
        const rows = await db.getAll<Record<string, unknown>>(
          `${TASK_WITH_PAGE_SQL} where p.view_type = 'habits' and t.parent_task_id is null
           order by t.position`,
        );
        return rows.map(toTaskWithPage) as HabitTask[];
      }
      await supabase.rpc('refresh_cycles', {});
      const { data, error } = await supabase
        .from('tasks')
        .select('*, page:pages(name, icon, view_type)')
        .in('page_id', pageIds)
        .is('parent_task_id', null)
        .order('position');
      if (error) throw error;
      return data as HabitTask[];
    },
  });
}

/** Datas (no fuso do usuário) em que cada tarefa foi concluída desde `since`. Para sequência e calendário. */
export function useCompletionDates(taskIds: string[], since: string, timeZone: string) {
  return useQuery({
    queryKey: ['tasks', 'completions', since, ...[...taskIds].sort()],
    enabled: taskIds.length > 0,
    queryFn: async () => {
      const data = isLocal()
        ? await localCompletions(taskIds, since)
        : await remoteCompletions(taskIds, since);
      // Objeto simples (não Map): o cache é salvo em JSON para abrir offline
      const byTask: Record<string, string[]> = {};
      for (const c of data) {
        (byTask[c.task_id] ??= []).push(todayIn(timeZone, new Date(c.completed_at)));
      }
      return byTask;
    },
  });
}

async function remoteCompletions(taskIds: string[], since: string) {
  const { data, error } = await supabase
    .from('task_completions')
    .select('task_id, completed_at')
    .in('task_id', taskIds)
    .gte('completed_at', since);
  if (error) throw error;
  return data;
}

async function localCompletions(taskIds: string[], since: string) {
  const rows = await db.getAll<{ task_id: string; completed_at: string }>(
    `select task_id, completed_at from task_completions
     where task_id in (select value from json_each(?)) and datetime(completed_at) >= datetime(?)`,
    [JSON.stringify(taskIds), since],
  );
  return rows.map((r) => ({ ...r, completed_at: r.completed_at.replace(' ', 'T') }));
}

/** Uma tarefa: primeiro procura nas listas em cache, depois busca no banco. */
export function useTask(id: string | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['tasks', 'one', id ?? ''],
    enabled: !!id,
    initialData: () => findCachedTask(queryClient, id!),
    queryFn: async () => {
      const task = isLocal()
        ? ((await localTasks('select * from tasks where id = ?', [id]))[0] ?? null)
        : await supabase
            .from('tasks')
            .select('*')
            .eq('id', id ?? '')
            .maybeSingle()
            .then(({ data, error }) => {
              if (error) throw error;
              return data;
            });
      return task ? ((await overlayReceived([task], task.page_id))[0] ?? task) : null;
    },
  });
}

function findCachedTask(queryClient: QueryClient, id: string): Task | undefined {
  for (const [, data] of queryClient.getQueriesData<Task[] | Task | null>({
    queryKey: keys.tasks,
  })) {
    if (Array.isArray(data)) {
      const found = data.find((t) => t.id === id);
      if (found) return found;
    } else if (data?.id === id) {
      return data;
    }
  }
  return undefined;
}

// ============================================================
// Atualização otimista
// ============================================================

/** Aplica a mudança em todas as listas de tarefas do cache (página, Hoje, tarefa avulsa). */
export function patchTaskLists(queryClient: QueryClient, patch: (task: Task) => Task | null) {
  queryClient.setQueriesData<Task[] | Task | null>({ queryKey: keys.tasks }, (data) => {
    if (Array.isArray(data)) {
      return data.map(patch).filter((t): t is Task => t !== null);
    }
    return data ? patch(data) : data;
  });
}

/**
 * Só recarrega quando a última mutação de tarefa em sequência termina. Antes disso, o refetch
 * traria a lista sem as mudanças ainda em voo e elas "piscariam" na tela.
 */
export function invalidateWhenIdle(queryClient: QueryClient) {
  if (queryClient.isMutating({ mutationKey: taskMutationKey }) === 1) {
    return queryClient.invalidateQueries({ queryKey: keys.tasks });
  }
}

export async function snapshot(queryClient: QueryClient) {
  await queryClient.cancelQueries({ queryKey: keys.tasks });
  return queryClient.getQueriesData({ queryKey: keys.tasks });
}

export function restore(
  queryClient: QueryClient,
  saved: [readonly unknown[], unknown][] | undefined,
) {
  saved?.forEach(([key, data]) => queryClient.setQueryData(key, data));
}

// ============================================================
// Criar (uma ou várias, sempre pelo create_tasks_batch)
// ============================================================

/** Responsável no formato do create_tasks_batch (membro ou nome pendente). */
export type NewAssignee = { user_id: string } | { pending_name: string };

type NewTask = ParsedTask & {
  done?: boolean;
  /** Hábito: tipo e meta já na criação */
  habitKind?: Task['habit_kind'];
  habitTarget?: number | null;
  assignees?: NewAssignee[];
  children?: NewSubtask[];
};
/** Subtarefa do lote: pode ter subtarefas também (árvore, V3 §1). */
type NewSubtask = ParsedTask & {
  /** Id do aparelho (o lote gera antes, para ligar pré-requisitos "^2" entre itens) */
  id?: string;
  done?: boolean;
  assignees?: NewAssignee[];
  children?: NewSubtask[];
};

type RpcItem = {
  id: string;
  title: string;
  priority: number;
  due_date: string | null;
  labels: string[];
  recurrence: ParsedTask['recurrence'];
  meta: ParsedTask['meta'];
  repeat_plan: ParsedTask['repeatPlan'];
  done: boolean;
  assignees: NewAssignee[];
  children: RpcItem[];
  habit_kind?: Task['habit_kind'];
  habit_target?: number | null;
};

function toRpcItem(item: NewTask & { id: string }): RpcItem {
  return {
    id: item.id,
    title: item.title,
    priority: item.priority,
    due_date: item.dueDate,
    labels: item.labels,
    recurrence: item.recurrence,
    meta: item.meta,
    repeat_plan: item.repeatPlan ?? null,
    done: item.done ?? false,
    assignees: item.assignees ?? [],
    children: (item.children ?? []).map((c) => toRpcItem({ ...c, id: c.id ?? uuidv7() })),
    ...(item.habitKind
      ? { habit_kind: item.habitKind, habit_target: item.habitTarget ?? null }
      : {}),
  };
}

function optimisticTask(
  pageId: string,
  item: NewTask & { id: string },
  now: string,
  page?: Pick<Page, 'name' | 'icon'>,
): TaskWithPage {
  return {
    id: item.id,
    page_id: pageId,
    folder_id: '',
    parent_task_id: null,
    depth: 1,
    estimate_minutes: null,
    deps_mode: 'all',
    started_at: null,
    title: item.title,
    notes: null,
    status: item.done ? 'done' : 'todo',
    priority: item.priority,
    due_date: item.dueDate,
    labels: item.labels,
    recurrence: item.recurrence as Json,
    position: Number.MAX_SAFE_INTEGER,
    meta: item.meta as Json,
    repeat_plan: (item.repeatPlan ?? null) as Json,
    actual_minutes: 0,
    weight: null,
    done_cycle_key: null,
    habit_kind: item.habitKind ?? 'check',
    habit_target: item.habitKind === 'counter' ? (item.habitTarget ?? 1) : null,
    count_up: 0,
    count_down: 0,
    count_key: null,
    created_by: '',
    completed_by: null,
    completed_at: item.done ? now : null,
    created_at: now,
    updated_at: now,
    updated_by: null,
    version: 1,
    page: page ? { name: page.name, icon: page.icon } : null,
  };
}

export function useCreateTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    ...offlineTaskMutation(createTasksKey),
    mutationFn: createTasksFn,
    onMutate: async ({ pageId, items }) => {
      const saved = await snapshot(queryClient);
      const now = new Date().toISOString();
      queryClient.setQueryData<Task[]>(keys.pageTasks(pageId), (tasks) => {
        if (!tasks) return tasks;
        let position = tasks
          .filter((t) => !t.parent_task_id)
          .reduce((m, t) => Math.max(m, t.position), 0);
        const optimistic: Task[] = items.map((item) => ({
          ...optimisticTask(pageId, item, now),
          position: ++position,
        }));
        return [...tasks, ...optimistic];
      });
      // Na tela Hoje, as que vencem até hoje já aparecem (página vem da árvore em cache)
      const page = queryClient.getQueryData<Tree>(keys.tree)?.pages.find((p) => p.id === pageId);
      for (const [key] of queryClient.getQueriesData<TaskWithPage[]>({
        queryKey: ['tasks', 'today'],
      })) {
        const today = key[2] as string;
        queryClient.setQueryData<TaskWithPage[]>(key, (tasks) =>
          tasks
            ? [
                ...tasks,
                ...items
                  .filter((i) => !i.done && i.dueDate && i.dueDate <= today)
                  .map((i) => optimisticTask(pageId, i, now, page)),
              ]
            : tasks,
        );
      }
      // Responsáveis aparecem na hora (o servidor confirma no onSettled)
      const newAssignees = items.flatMap((item) =>
        (item.assignees ?? []).map((a): Tables<'task_assignees'> => ({
          id: uuidv7(),
          task_id: item.id,
          folder_id: '',
          user_id: 'user_id' in a ? a.user_id : null,
          pending_name: 'pending_name' in a ? a.pending_name : null,
          created_by: null,
          created_at: now,
        })),
      );
      if (newAssignees.length) {
        queryClient.setQueryData<Tables<'task_assignees'>[]>(keys.assignees, (list) =>
          list ? [...list, ...newAssignees] : list,
        );
      }
      return { saved };
    },
    onError: (_err, _vars, context) => restore(queryClient, context?.saved),
    onSettled: (_data, _err, { items }) => {
      if (items.some((i) => i.assignees?.length)) {
        queryClient.invalidateQueries({ queryKey: keys.assignees });
        queryClient.invalidateQueries({ queryKey: keys.mine });
      }
      invalidateWhenIdle(queryClient);
      // [x] do lote conta para a sequência (Fase 3)
      if (items.some((i) => i.done)) queryClient.invalidateQueries({ queryKey: keys.game });
    },
  });
}

/** Atalho para criar uma subtarefa direto (sem sintaxe rápida). */
export function useCreateSubtask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: taskMutationKey,
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async ({ parent, title, id }: { parent: Task; title: string; id: string }) => {
      if (isLocal()) {
        const userId = await sessionUserId();
        await db.writeTransaction((tx) =>
          insertLocalTask(
            tx,
            {
              id,
              page_id: parent.page_id,
              folder_id: parent.folder_id,
              parent_task_id: parent.id,
              depth: (parent.depth ?? 1) + 1,
              // O servidor faz o mesmo (herda as etiquetas da mãe)
              labels: parent.labels,
              title,
              position: Date.now(),
            },
            userId,
          ),
        );
        return;
      }
      const { error } = await supabase.from('tasks').insert({
        id,
        page_id: parent.page_id,
        parent_task_id: parent.id,
        title,
        position: Date.now(),
      });
      if (error) throw error;
    },
    onSettled: () => invalidateWhenIdle(queryClient),
  });
}

// ============================================================
// Concluir / desfazer
// ============================================================

export function useToggleTask() {
  const queryClient = useQueryClient();

  return useMutation({
    ...offlineTaskMutation(toggleTaskKey),
    mutationFn: toggleTaskFn,
    onMutate: async ({ id, done, nextDue }) => {
      const saved = await snapshot(queryClient);
      const now = new Date().toISOString();
      patchTaskLists(queryClient, (t) => {
        if (t.id !== id) return t;
        // Recorrente comum: o servidor avança a data e a tarefa continua aberta
        if (done && nextDue) return { ...t, due_date: nextDue };
        return { ...t, status: done ? 'done' : 'todo', completed_at: done ? now : null };
      });
      return { saved };
    },
    onError: (_err, _vars, context) => restore(queryClient, context?.saved),
    onSettled: () => {
      invalidateWhenIdle(queryClient);
      // XP, bosses (solo, clã, projeto) e o quadro de contribuição mudam junto
      queryClient.invalidateQueries({ queryKey: keys.game });
      queryClient.invalidateQueries({ queryKey: ['project-boss'] });
      queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
}

// ============================================================
// Editar / mover / apagar
// ============================================================

export type TaskPatch = Partial<
  Pick<
    Task,
    | 'title'
    | 'notes'
    | 'priority'
    | 'due_date'
    | 'labels'
    | 'page_id'
    | 'parent_task_id'
    | 'position'
    | 'recurrence'
    | 'meta'
    | 'repeat_plan'
    | 'habit_kind'
    | 'habit_target'
    | 'estimate_minutes'
    | 'deps_mode'
  >
>;

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    ...offlineTaskMutation(updateTaskKey),
    mutationFn: updateTaskFn,
    onMutate: async ({ id, patch }) => {
      const saved = await snapshot(queryClient);
      patchTaskLists(queryClient, (t) => (t.id === id ? { ...t, ...patch } : t));
      return { saved };
    },
    onError: (_err, _vars, context) => restore(queryClient, context?.saved),
    onSettled: () => invalidateWhenIdle(queryClient),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: taskMutationKey,
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async (id: string) => {
      if (isLocal()) {
        await db.execute('delete from tasks where id = ? or parent_task_id = ?', [id, id]);
        return;
      }
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      const saved = await snapshot(queryClient);
      patchTaskLists(queryClient, (t) => (t.id === id || t.parent_task_id === id ? null : t));
      return { saved };
    },
    onError: (_err, _vars, context) => restore(queryClient, context?.saved),
    onSettled: () => invalidateWhenIdle(queryClient),
  });
}

/**
 * Próximo vencimento se concluir esta tarefa só avança a data (recorrente fora de hábitos e de páginas
 * com reset; igual ao complete_task). null = concluir marca como feita.
 */
export function advanceOnComplete(
  task: Task,
  page: Pick<Page, 'view_type' | 'reset_cycle'> | undefined,
  today: string,
) {
  if (!page || task.parent_task_id || page.view_type === 'habits' || page.reset_cycle !== 'none')
    return null;
  return nextDueDate(asRecurrence(task.recurrence), task.due_date, today);
}

// ============================================================
// Fila offline: criar, marcar/desmarcar e editar/reordenar funcionam sem
// internet. O TanStack Query pausa a mutação, o cache persistido guarda a fila e, com a conexão
// de volta, reenvia na ordem (o scope único garante uma de cada vez). Depois de fechar e abrir o
// app, quem sabe executar é o setMutationDefaults (providers/query.tsx), com as funções abaixo.
// ============================================================

export const createTasksKey = [...taskMutationKey, 'create'] as const;
export const toggleTaskKey = [...taskMutationKey, 'toggle'] as const;
export const updateTaskKey = [...taskMutationKey, 'update'] as const;
export const statusTaskKey = [...taskMutationKey, 'status'] as const;
export const habitTickKey = [...taskMutationKey, 'habit'] as const;
export const undoHabitTickKey = [...taskMutationKey, 'habit-undo'] as const;

/** Mesma fila para todas as mutações de tarefa: a ordem de envio é a ordem em que foram feitas. */
const offlineTaskMutation = (mutationKey: readonly unknown[]) =>
  ({
    mutationKey,
    scope: { id: 'tasks' },
    // Gravando no banco do aparelho, a mutação roda mesmo sem rede (o sync envia depois)
    networkMode: isLocal() ? 'always' : 'online',
  }) as const;

export type CreateTasksVars = { pageId: string; items: (NewTask & { id: string })[] };
export type ToggleTaskVars = { id: string; done: boolean; nextDue?: string | null };
export type UpdateTaskVars = { id: string; patch: TaskPatch };
export type TaskStatus = Task['status'];
export type StatusTaskVars = { id: string; status: TaskStatus };
/** `id`: id do evento, gerado aqui, para o reenvio da fila não contar duas vezes */
export type HabitTickVars = { taskId: string; delta: 1 | -1; id: string };

export async function createTasksFn({ pageId, items }: CreateTasksVars) {
  if (isLocal()) return createLocalTasks(pageId, items);
  const { error } = await supabase.rpc('create_tasks_batch', {
    p_page_id: pageId,
    p_items: items.map(toRpcItem) as unknown as Json,
  });
  if (error) throw error;
}

export async function toggleTaskFn({
  id,
  done,
  nextDue,
}: ToggleTaskVars): Promise<CompletionSummary | null> {
  // Página recebida (L2): marca o item do aluno, não a tarefa do autor
  const received = await isReceivedTask(id);
  if (received) {
    await checkReceivedItem(id, received.pageId, done);
    return null;
  }
  if (isLocal()) {
    const task = done ? await localTaskForXp(id) : null;
    const estimate = task ? estimateCompletionXp(task) : 0;
    const result = await runCommand(
      done ? 'complete_task' : 'uncomplete_task',
      { p_task_id: id },
      (tx) =>
        done && nextDue
          ? tx.execute('update tasks set due_date = ? where id = ?', [nextDue, id])
          : tx.execute('update tasks set status = ?, completed_at = ? where id = ?', [
              done ? 'done' : 'todo',
              done ? new Date().toISOString() : null,
              id,
            ]),
      estimate,
    );
    if (result == null && estimate > 0) return pendingSummary(estimate);
    return completionSummarySchema.safeParse(result).data ?? null;
  }
  const { data, error } = await supabase.rpc(done ? 'complete_task' : 'uncomplete_task', {
    p_task_id: id,
  });
  if (error) throw error;
  // XP, nível, boss e conquistas vêm junto (Fase 3); se o formato mudar, a marcação vale igual
  return completionSummarySchema.safeParse(data).data ?? null;
}

/** Marca/desmarca o item da página recebida: check_item (pela fila, offline) com o reflexo local. */
async function checkReceivedItem(id: string, pageId: string, done: boolean) {
  const args = { p_task_id: id, p_done: done, p_note: null };
  if (!isLocal()) {
    const { error } = await supabase.rpc('run_once', {
      p_key: uuidv7(),
      p_name: 'check_item',
      p_args: args as Json,
    });
    if (error) throw error;
    return;
  }
  const userId = await sessionUserId();
  const task = await db.getOptional<{ recurrence: string | null }>(
    'select recurrence from tasks where id = ?',
    [id],
  );
  const key = await localCycleKey(pageId, task?.recurrence ? JSON.parse(task.recurrence) : null);
  await runCommand('check_item', args, async (tx) => {
    await tx.execute(
      'delete from share_checks where task_id = ? and user_id = ? and cycle_key = ?',
      [id, userId, key],
    );
    if (done)
      await tx.execute(
        'insert into share_checks (id, task_id, page_id, user_id, cycle_key, done_at) values (?, ?, ?, ?, ?, ?)',
        [uuidv7(), id, pageId, userId, key, new Date().toISOString()],
      );
  });
}

/** Só os campos mudados vão para o servidor: em conflito, a última escrita vence por campo. */
export async function updateTaskFn({ id, patch }: UpdateTaskVars) {
  if (isLocal()) {
    const columns = Object.keys(patch) as (keyof TaskPatch)[];
    if (columns.length === 0) return;
    await db.execute(`update tasks set ${columns.map((c) => `${c} = ?`).join(', ')} where id = ?`, [
      ...columns.map((c) => toSqlValue(patch[c])),
      id,
    ]);
    return;
  }
  const { error } = await supabase.from('tasks').update(patch).eq('id', id);
  if (error) throw error;
}

/** Kanban: mover entre A fazer, Fazendo e Feito (Feito = concluir, com XP). */
/** Prioridade, tipo da página e recorrência: o que a estimativa de XP pendente usa. */
export function localTaskForXp(id: string) {
  return db.getOptional<{
    priority: number;
    parent_task_id: string | null;
    recurrence: string | null;
    view_type: string | null;
  }>(
    `select t.priority, t.parent_task_id, t.recurrence, p.view_type from tasks t
     left join pages p on p.id = t.page_id where t.id = ?`,
    [id],
  );
}

/** "+" de hábito bom vale XP; no contador, só o toque que bate a meta. */
function estimateHabitTickXp(task: Task, delta: 1 | -1) {
  if (delta !== 1) return 0;
  if (task.habit_kind === 'plusminus') return gamificationConfig.xp.habitPlus;
  if (task.habit_kind === 'counter' && task.count_up + 1 === (task.habit_target ?? 1))
    return gamificationConfig.xp.habit;
  return 0;
}

/** Resposta "de mentira" enquanto o comando está na fila: só o XP estimado, marcado pendente. */
export const pendingSummary = (xp: number): CompletionSummary => ({
  xp,
  level: null,
  level_up: false,
  boss_defeated: false,
  achievements: [],
  pending: true,
});

export async function setTaskStatusFn({
  id,
  status,
}: StatusTaskVars): Promise<CompletionSummary | null> {
  const received = await isReceivedTask(id);
  if (received) {
    await checkReceivedItem(id, received.pageId, status === 'done');
    return null;
  }
  if (isLocal()) {
    const task = status === 'done' ? await localTaskForXp(id) : null;
    const estimate = task ? estimateCompletionXp(task) : 0;
    const result = await runCommand(
      'set_task_status',
      { p_task_id: id, p_status: status },
      (tx) =>
        tx.execute('update tasks set status = ?, completed_at = ? where id = ?', [
          status,
          status === 'done' ? new Date().toISOString() : null,
          id,
        ]),
      estimate,
    );
    if (result == null && estimate > 0) return pendingSummary(estimate);
    return completionSummarySchema.safeParse(result).data ?? null;
  }
  const { data, error } = await supabase.rpc('set_task_status', {
    p_task_id: id,
    p_status: status,
  });
  if (error) throw error;
  return completionSummarySchema.safeParse(data).data ?? null;
}

/** Um toque no + ou − de um hábito contador ou bom/ruim. */
export async function habitTickFn({
  taskId,
  delta,
  id,
}: HabitTickVars): Promise<CompletionSummary | null> {
  if (isLocal()) {
    const before = await db.getOptional<Record<string, unknown>>(
      'select * from tasks where id = ?',
      [taskId],
    );
    const result = await runCommand(
      'habit_tick',
      { p_task_id: taskId, p_delta: delta, p_id: id },
      async (tx) => {
        // Pela transação: o `db` esperaria esta mesma transação terminar
        const row = await tx.getOptional<Record<string, unknown>>(
          'select * from tasks where id = ?',
          [taskId],
        );
        if (!row) return;
        const next = applyHabitTick(toTask(row), delta);
        await tx.execute(
          'update tasks set count_up = ?, count_down = ?, status = ?, completed_at = ? where id = ?',
          [next.count_up, next.count_down, next.status, next.completed_at, taskId],
        );
      },
      before ? estimateHabitTickXp(toTask(before), delta) : 0,
    );
    if (result == null && before) {
      const estimate = estimateHabitTickXp(toTask(before), delta);
      if (estimate > 0) return pendingSummary(estimate);
    }
    return completionSummarySchema.safeParse(result).data ?? null;
  }
  const { data, error } = await supabase.rpc('habit_tick', {
    p_task_id: taskId,
    p_delta: delta,
    p_id: id,
  });
  if (error) throw error;
  return completionSummarySchema.safeParse(data).data ?? null;
}

export async function undoHabitTickFn({ id, taskId, delta }: HabitTickVars) {
  if (isLocal()) {
    const column = delta === 1 ? 'count_up' : 'count_down';
    await runCommand('undo_habit_tick', { p_event_id: id }, (tx) =>
      tx.execute(`update tasks set ${column} = max(0, ${column} - 1) where id = ?`, [taskId]),
    );
    return;
  }
  const { error } = await supabase.rpc('undo_habit_tick', { p_event_id: id });
  if (error) throw error;
}

/** Registra as funções da fila (para as mutações restauradas do disco depois de reabrir o app). */
export function registerOfflineTaskMutations(queryClient: QueryClient) {
  const settle = () => {
    invalidateWhenIdle(queryClient);
    queryClient.invalidateQueries({ queryKey: keys.game });
  };
  queryClient.setMutationDefaults(createTasksKey, {
    ...offlineTaskMutation(createTasksKey),
    mutationFn: (vars: CreateTasksVars) => createTasksFn(vars),
    onSettled: settle,
  });
  queryClient.setMutationDefaults(toggleTaskKey, {
    ...offlineTaskMutation(toggleTaskKey),
    mutationFn: (vars: ToggleTaskVars) => toggleTaskFn(vars),
    onSettled: settle,
  });
  queryClient.setMutationDefaults(updateTaskKey, {
    ...offlineTaskMutation(updateTaskKey),
    mutationFn: (vars: UpdateTaskVars) => updateTaskFn(vars),
    onSettled: settle,
  });
  queryClient.setMutationDefaults(statusTaskKey, {
    ...offlineTaskMutation(statusTaskKey),
    mutationFn: (vars: StatusTaskVars) => setTaskStatusFn(vars),
    onSettled: settle,
  });
  queryClient.setMutationDefaults(habitTickKey, {
    ...offlineTaskMutation(habitTickKey),
    mutationFn: (vars: HabitTickVars) => habitTickFn(vars),
    onSettled: settle,
  });
  queryClient.setMutationDefaults(undoHabitTickKey, {
    ...offlineTaskMutation(undoHabitTickKey),
    mutationFn: (vars: HabitTickVars) => undoHabitTickFn(vars),
    onSettled: settle,
  });
}

/** Contagens depois de um toque (espelho do habit_tick, para a tela mudar na hora). */
export function applyHabitTick(task: Task, delta: 1 | -1): Task {
  if (task.habit_kind === 'counter') {
    const target = task.habit_target ?? 1;
    const count = Math.max(0, Math.min(target, task.count_up + delta));
    const done = count >= target;
    return {
      ...task,
      count_up: count,
      status: done ? 'done' : task.status === 'done' ? 'todo' : task.status,
      completed_at: done ? (task.completed_at ?? new Date().toISOString()) : null,
    };
  }
  return delta === 1
    ? { ...task, count_up: task.count_up + 1 }
    : { ...task, count_down: task.count_down + 1 };
}

export function useHabitTick() {
  const queryClient = useQueryClient();
  return useMutation({
    ...offlineTaskMutation(habitTickKey),
    mutationFn: habitTickFn,
    onMutate: async ({ taskId, delta }) => {
      const saved = await snapshot(queryClient);
      patchTaskLists(queryClient, (t) => (t.id === taskId ? applyHabitTick(t, delta) : t));
      return { saved };
    },
    onError: (_err, _vars, context) => restore(queryClient, context?.saved),
    onSettled: () => {
      invalidateWhenIdle(queryClient);
      queryClient.invalidateQueries({ queryKey: keys.game });
    },
  });
}

/** Desfaz um + ou − de hábito bom/ruim (o "Desfazer" do aviso). Recebe o mesmo vars do toque. */
export function useUndoHabitTick() {
  const queryClient = useQueryClient();
  return useMutation({
    ...offlineTaskMutation(undoHabitTickKey),
    mutationFn: undoHabitTickFn,
    onMutate: async ({ taskId, delta }: HabitTickVars) => {
      const saved = await snapshot(queryClient);
      patchTaskLists(queryClient, (t) =>
        t.id !== taskId
          ? t
          : delta === 1
            ? { ...t, count_up: Math.max(0, t.count_up - 1) }
            : { ...t, count_down: Math.max(0, t.count_down - 1) },
      );
      return { saved };
    },
    onError: (_err, _vars, context) => restore(queryClient, context?.saved),
    onSettled: () => {
      invalidateWhenIdle(queryClient);
      queryClient.invalidateQueries({ queryKey: keys.game });
    },
  });
}

export function useSetTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    ...offlineTaskMutation(statusTaskKey),
    mutationFn: setTaskStatusFn,
    onMutate: async ({ id, status }) => {
      const saved = await snapshot(queryClient);
      const now = new Date().toISOString();
      patchTaskLists(queryClient, (t) =>
        t.id === id ? { ...t, status, completed_at: status === 'done' ? now : null } : t,
      );
      return { saved };
    },
    onError: (_err, _vars, context) => restore(queryClient, context?.saved),
    onSettled: () => {
      invalidateWhenIdle(queryClient);
      queryClient.invalidateQueries({ queryKey: keys.game });
      queryClient.invalidateQueries({ queryKey: ['project-boss'] });
      queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
}

// ============================================================
// Criar no banco do aparelho (o sync manda pelo create_tasks_batch)
// ============================================================

type LocalTaskInsert = {
  id: string;
  page_id: string;
  folder_id: string;
  title: string;
  position: number;
  parent_task_id?: string | null;
  depth?: number;
  priority?: number;
  due_date?: string | null;
  labels?: string[];
  recurrence?: unknown;
  meta?: unknown;
  repeat_plan?: unknown;
  habit_kind?: string;
  habit_target?: number | null;
};

type Tx = { execute: (sql: string, params?: unknown[]) => Promise<unknown> };

async function insertLocalTask(tx: Tx, task: LocalTaskInsert, userId: string | null) {
  const now = new Date().toISOString();
  await tx.execute(
    `insert into tasks (id, page_id, folder_id, parent_task_id, depth, title, status, priority, due_date,
       labels, recurrence, meta, repeat_plan, position, habit_kind, habit_target, count_up, count_down,
       created_by, created_at, updated_at, version)
     values (?, ?, ?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, 1)`,
    [
      task.id,
      task.page_id,
      task.folder_id,
      task.parent_task_id ?? null,
      // O servidor recalcula; aqui é para a árvore já aparecer certa offline
      task.depth ?? (task.parent_task_id ? 2 : 1),
      task.title,
      task.priority ?? 0,
      task.due_date ?? null,
      JSON.stringify(task.labels ?? []),
      toSqlValue(task.recurrence ?? null),
      toSqlValue(task.meta ?? null),
      toSqlValue(task.repeat_plan ?? null),
      task.position,
      task.habit_kind ?? 'check',
      task.habit_target ?? null,
      userId,
      now,
      now,
    ],
  );
}

async function completeInTx(tx: Tx, id: string) {
  await tx.execute("update tasks set status = 'done', completed_at = ? where id = ?", [
    new Date().toISOString(),
    id,
  ]);
  await tx.execute('insert into commands (id, name, args) values (?, ?, ?)', [
    uuidv7(),
    'complete_task',
    JSON.stringify({ p_task_id: id }),
  ]);
}

/** Tudo numa transação: o envio junta as tarefas da mesma página num create_tasks_batch só. */
async function createLocalTasks(pageId: string, items: CreateTasksVars['items']) {
  const page = await db.getOptional<{ folder_id: string }>(
    'select folder_id from pages where id = ?',
    [pageId],
  );
  if (!page) throw new Error('Página não encontrada no aparelho');
  const userId = await sessionUserId();
  await db.writeTransaction(async (tx) => {
    const last = await tx.get<{ max: number | null }>(
      'select max(position) as max from tasks where page_id = ? and parent_task_id is null',
      [pageId],
    );
    let position = last.max ?? 0;
    const done: string[] = [];
    for (const item of items) {
      await insertLocalTask(
        tx,
        {
          id: item.id,
          page_id: pageId,
          folder_id: page.folder_id,
          title: item.title,
          position: ++position,
          priority: item.priority,
          due_date: item.dueDate,
          labels: item.labels,
          recurrence: item.recurrence,
          meta: item.meta,
          repeat_plan: item.repeatPlan,
          habit_kind: item.habitKind,
          habit_target: item.habitKind === 'counter' ? (item.habitTarget ?? 1) : null,
        },
        userId,
      );
      // Subtarefas em quantos níveis vierem (o limite já foi aplicado na prévia)
      const insertChildren = async (parentId: string, depth: number, children: NewSubtask[]) => {
        let childPosition = 0;
        for (const child of children) {
          const childId = child.id ?? uuidv7();
          await insertLocalTask(
            tx,
            {
              id: childId,
              page_id: pageId,
              folder_id: page.folder_id,
              parent_task_id: parentId,
              depth,
              title: child.title,
              position: ++childPosition,
              priority: child.priority,
              due_date: child.dueDate,
              labels: child.labels,
              repeat_plan: child.repeatPlan,
            },
            userId,
          );
          await insertChildren(childId, depth + 1, child.children ?? []);
          if (child.done) done.push(childId);
        }
      };
      await insertChildren(item.id, 2, item.children ?? []);
      for (const assignee of item.assignees ?? []) {
        await tx.execute(
          'insert into task_assignees (id, task_id, folder_id, user_id, pending_name) values (?, ?, ?, ?, ?)',
          [
            uuidv7(),
            item.id,
            page.folder_id,
            'user_id' in assignee ? assignee.user_id : null,
            'pending_name' in assignee ? assignee.pending_name : null,
          ],
        );
      }
      if (item.done) done.push(item.id);
    }
    // Conclusões por último: no envio, depois de as tarefas existirem no servidor
    for (const id of done) await completeInTx(tx, id);
  });
}

/** "Concluir tudo": a tarefa e o galho inteiro (as folhas abertas; as mães fecham junto). */
export function useCompleteTree() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: taskMutationKey,
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async (id: string) => {
      if (isLocal()) {
        await runCommand('complete_tree', { p_task_id: id }, (tx) =>
          tx.execute(
            `with recursive galho(id) as (
               select ? union all select t.id from tasks t join galho g on t.parent_task_id = g.id
             )
             update tasks set status = 'done', completed_at = ? where id in (select id from galho)
               and status <> 'done'`,
            [id, new Date().toISOString()],
          ),
        );
        return;
      }
      const { error } = await supabase.rpc('complete_tree', { p_task_id: id });
      if (error) throw error;
    },
    onSettled: () => {
      invalidateWhenIdle(queryClient);
      queryClient.invalidateQueries({ queryKey: keys.game });
    },
  });
}
