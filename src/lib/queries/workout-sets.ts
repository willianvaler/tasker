import type { Transaction } from '@powersync/common';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { EffortScale } from '../gym/effort';
import type { RecordKind } from '../gym/records';
import { textToKg } from '../gym/units';
import { readRepeatPlan } from '../repeat';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, runCommand, sessionUserId } from '../sync/local';
import { uuidv7 } from '../uuid';
import { parseList } from './exercises';
import { keys } from './keys';
import type { Task } from './tasks';

// Diário de treino (AC4, D236): cada série como aconteceu, em `workout_sets`. Só o servidor
// grava (log_rep, log_group_set, log_warmup); aqui ficam o reflexo local, o aquecimento, o
// apagar e o histórico.

export type SetKind = 'reps' | 'time' | 'cardio';

/** O que a tela manda junto com a série (vai em `p_values`). */
export type SetValues = {
  weight?: string | null;
  reps?: number | null;
  kind?: SetKind;
  duration_seconds?: number | null;
  distance_m?: number | null;
  effort?: number | null;
  effort_scale?: EffortScale | null;
  warmup?: boolean;
  /** Repetições que a série pedia (AC6: a progressão julga a sessão) */
  target_reps?: number | null;
};

/** Uma série do diário. Só JSON (vai para o cache). */
export type WorkoutSet = {
  id: string;
  task_id: string | null;
  exercise_id: string | null;
  exercise_name: string;
  set_index: number;
  kind: SetKind;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  distance_m: number | null;
  warmup: boolean;
  effort: number | null;
  effort_scale: EffortScale | null;
  performed_at: string;
  /** Recordes que a série bateu (AC5), calculados no servidor */
  records: RecordKind[];
  /** Meta da série (AC6) */
  target_reps: number | null;
  target_sets: number | null;
  target_seconds: number | null;
};

const COLUMNS =
  'id, task_id, exercise_id, exercise_name, set_index, kind, weight_kg, reps, duration_seconds, distance_m, warmup, effort, effort_scale, performed_at, records, target_reps, target_sets, target_seconds';

const metaReps = (task: Task) => {
  const meta = task.meta as { reps?: unknown } | null;
  return typeof meta?.reps === 'number' ? meta.reps : null;
};

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * O reflexo local de uma série (antes da resposta do servidor), com as mesmas regras do
 * `_record_set`: carga em kg pelo texto, tempo do plano no item por tempo.
 */
export async function insertLocalSet(
  tx: Transaction,
  task: Task,
  userId: string | null,
  id: string,
  values: SetValues,
  index: number,
) {
  const plan = readRepeatPlan(task.repeat_plan);
  const kind: SetKind = values.kind ?? (plan?.mode === 'timed' ? 'time' : 'reps');
  const scale = values.effort_scale && num(values.effort) != null ? values.effort_scale : null;
  await tx.execute(
    `insert into workout_sets (id, user_id, task_id, page_id, exercise_id, exercise_name, cycle_key,
       set_index, kind, weight_kg, reps, duration_seconds, distance_m, warmup, effort, effort_scale, performed_at,
       target_reps, target_sets, target_seconds)
     values (?, ?, ?, ?, ?, ?, 'local', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      task.id,
      task.page_id,
      task.exercise_id ?? null,
      task.title,
      index,
      kind,
      textToKg(values.weight) ?? null,
      num(values.reps),
      num(values.duration_seconds) ?? (kind === 'time' ? (plan?.duration_seconds ?? null) : null),
      num(values.distance_m),
      values.warmup ? 1 : 0,
      scale ? values.effort : null,
      scale,
      new Date().toISOString(),
      num(values.target_reps) ?? metaReps(task),
      plan?.total ?? null,
      kind === 'time' ? (plan?.duration_seconds ?? null) : null,
    ],
  );
}

/** Desfazer no aparelho: some a última série que conta desta tarefa. */
export async function deleteLastLocalSet(tx: Transaction, taskId: string, userId: string | null) {
  await tx.execute(
    `delete from workout_sets where id = (select id from workout_sets
       where task_id = ? and user_id = ? and not warmup order by performed_at desc, set_index desc limit 1)`,
    [taskId, userId],
  );
}

const fromRow = (r: Record<string, unknown>): WorkoutSet => ({
  id: String(r.id),
  task_id: (r.task_id as string) ?? null,
  exercise_id: (r.exercise_id as string) ?? null,
  exercise_name: String(r.exercise_name ?? ''),
  set_index: Number(r.set_index ?? 0),
  kind: (r.kind as SetKind) ?? 'reps',
  weight_kg: r.weight_kg == null ? null : Number(r.weight_kg),
  reps: r.reps == null ? null : Number(r.reps),
  duration_seconds: r.duration_seconds == null ? null : Number(r.duration_seconds),
  distance_m: r.distance_m == null ? null : Number(r.distance_m),
  warmup: r.warmup === true || r.warmup === 1,
  effort: r.effort == null ? null : Number(r.effort),
  effort_scale: (r.effort_scale as EffortScale) ?? null,
  performed_at: String(r.performed_at),
  records: parseList(r.records) as RecordKind[],
  target_reps: r.target_reps == null ? null : Number(r.target_reps),
  target_sets: r.target_sets == null ? null : Number(r.target_sets),
  target_seconds: r.target_seconds == null ? null : Number(r.target_seconds),
});

/**
 * Histórico de um exercício (pelo exercício ligado) ou de um item (pela tarefa), do mais novo
 * para o mais velho. Sem exercício e sem tarefa, nada.
 */
export function useWorkoutHistory(filter: { exerciseId?: string | null; taskId?: string | null }) {
  const { exerciseId, taskId } = filter;
  return useQuery({
    queryKey: [...keys.workoutSets, exerciseId ?? null, taskId ?? null],
    enabled: !!(exerciseId || taskId),
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<WorkoutSet[]> => {
      const userId = await sessionUserId();
      if (!userId) return [];
      const byExercise = !!exerciseId;
      if (isLocal()) {
        const rows = await db.getAll<Record<string, unknown>>(
          `select ${COLUMNS} from workout_sets where user_id = ? and ${byExercise ? 'exercise_id' : 'task_id'} = ?
           order by performed_at desc, set_index desc limit 500`,
          [userId, byExercise ? exerciseId : taskId],
        );
        return rows.map(fromRow);
      }
      const query = supabase.from('workout_sets').select(COLUMNS).eq('user_id', userId);
      const { data, error } = await (
        byExercise
          ? query.eq('exercise_id', exerciseId as string)
          : query.eq('task_id', taskId as string)
      )
        .order('performed_at', { ascending: false })
        .order('set_index', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((r) => fromRow(r as Record<string, unknown>));
    },
  });
}

/** Aquecimento (não conta série) e apagar série do diário, pela fila do aparelho. */
export function useWorkoutSetActions() {
  const queryClient = useQueryClient();
  const settle = () => queryClient.invalidateQueries({ queryKey: keys.workoutSets });
  const call = async (name: 'log_warmup' | 'delete_workout_set', args: Record<string, unknown>) => {
    if (isLocal())
      return runCommand(name, args, async (tx) => {
        if (name === 'delete_workout_set')
          await tx.execute('delete from workout_sets where id = ?', [args.p_id]);
      });
    const { data, error } = await supabase.rpc('run_once', {
      p_key: uuidv7(),
      p_name: name,
      p_args: args as never,
    });
    if (error) throw error;
    return data;
  };

  const warmup = useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async ({ task, values }: { task: Task; values: SetValues }) => {
      const id = uuidv7();
      const withId = { ...values, warmup: true, set_id: id };
      if (isLocal()) {
        const userId = await sessionUserId();
        return runCommand('log_warmup', { p_task_id: task.id, p_values: withId }, (tx) =>
          insertLocalSet(tx, task, userId, id, withId, 0),
        );
      }
      return call('log_warmup', { p_task_id: task.id, p_values: withId });
    },
    onSettled: settle,
  });

  const remove = useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: (id: string) => call('delete_workout_set', { p_id: id }),
    onMutate: (id) => {
      queryClient.setQueriesData<WorkoutSet[]>({ queryKey: keys.workoutSets }, (list) =>
        list?.filter((s) => s.id !== id),
      );
    },
    onSettled: settle,
  });

  return { warmup, remove };
}
