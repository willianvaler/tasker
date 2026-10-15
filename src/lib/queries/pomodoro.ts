import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Json, Tables } from '../db';
import { DEFAULT_POMODORO, type PomodoroSettings } from '../pomodoro';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, runCommand, sessionUserId } from '../sync/local';
import { uuidv7 } from '../uuid';
import { keys } from './keys';

// Pomodoro e tempo (K, D129). A configuração é do servidor (com o cache do TanStack para abrir
// offline); o tempo registrado vem do aparelho quando o sync está ligado.

export type TimeEntry = Tables<'time_entries'>;

export function usePomodoroSettings() {
  return useQuery({
    queryKey: keys.pomodoro,
    queryFn: async (): Promise<PomodoroSettings> => {
      const { data, error } = await supabase.from('pomodoro_settings').select('*').maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_POMODORO;
      return {
        focus_minutes: data.focus_minutes,
        short_break_minutes: data.short_break_minutes,
        long_break_minutes: data.long_break_minutes,
        cycles: data.cycles,
        auto_start: data.auto_start,
        break_ideas: Array.isArray(data.break_ideas)
          ? data.break_ideas.filter((i): i is string => typeof i === 'string')
          : null,
        idea_order: data.idea_order === 'sequence' ? 'sequence' : 'random',
      };
    },
  });
}

export function useSavePomodoroSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: PomodoroSettings) => {
      // user_id nasce de auth.uid() (o cliente não escreve a coluna)
      const row = {
        ...settings,
        break_ideas: settings.break_ideas as Json,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('pomodoro_settings')
        .upsert(row as never, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onMutate: async (settings) => {
      await queryClient.cancelQueries({ queryKey: keys.pomodoro });
      const before = queryClient.getQueryData<PomodoroSettings>(keys.pomodoro);
      queryClient.setQueryData(keys.pomodoro, settings);
      return { before };
    },
    onError: (_err, _vars, context) => queryClient.setQueryData(keys.pomodoro, context?.before),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.pomodoro }),
  });
}

/** Tempo registrado na tarefa (de todos), do mais novo para o mais antigo. */
export function useTaskTime(taskId: string | undefined) {
  return useQuery({
    queryKey: [...keys.timeEntries, 'task', taskId ?? ''],
    enabled: !!taskId,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<TimeEntry[]> => {
      if (isLocal())
        return db.getAll<TimeEntry>(
          'select * from time_entries where task_id = ? order by started_at desc',
          [taskId],
        );
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('task_id', taskId ?? '')
        .order('started_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export type LogTimeVars = {
  id: string;
  taskId: string;
  minutes: number;
  /** 'YYYY-MM-DD'; sem dia, agora */
  day?: string | null;
  note?: string | null;
};

/** Lançar tempo à mão e apagar um registro (K3): pela fila do aparelho ou pelo run_once. */
export function useTimeEntryActions() {
  const queryClient = useQueryClient();
  const settle = () => {
    queryClient.invalidateQueries({ queryKey: keys.timeEntries });
    queryClient.invalidateQueries({ queryKey: keys.tasks });
  };
  const send = async (name: string, args: Record<string, unknown>, local: LocalChange) => {
    if (isLocal()) {
      await runCommand(name, args, local);
      return;
    }
    const { error } = await supabase.rpc('run_once', {
      p_key: uuidv7(),
      p_name: name,
      p_args: args as Json,
    });
    if (error) throw error;
  };
  const networkMode = isLocal() ? ('always' as const) : ('online' as const);

  const log = useMutation({
    networkMode,
    mutationFn: async ({ id, taskId, minutes, day, note }: LogTimeVars) => {
      const userId = await sessionUserId();
      const end = day ? `${day}T12:00:00.000Z` : new Date().toISOString();
      const start = new Date(Date.parse(end) - minutes * 60_000).toISOString();
      await send(
        'log_time',
        {
          p_id: id,
          p_task_id: taskId,
          p_minutes: minutes,
          p_day: day ?? null,
          p_note: note ?? null,
        },
        async (tx) => {
          await tx.execute(
            `insert into time_entries (id, user_id, task_id, source, started_at, ended_at, minutes, note, created_at)
             values (?, ?, ?, 'manual', ?, ?, ?, ?, ?)`,
            [id, userId, taskId, start, end, minutes, note ?? null, new Date().toISOString()],
          );
          await tx.execute('update tasks set actual_minutes = actual_minutes + ? where id = ?', [
            minutes,
            taskId,
          ]);
        },
      );
    },
    onSettled: settle,
  });

  const remove = useMutation({
    networkMode,
    mutationFn: async (entry: TimeEntry) => {
      await send('delete_time_entry', { p_id: entry.id }, async (tx) => {
        await tx.execute('delete from time_entries where id = ?', [entry.id]);
        if (entry.task_id)
          await tx.execute(
            'update tasks set actual_minutes = max(0, actual_minutes - ?) where id = ?',
            [entry.minutes, entry.task_id],
          );
      });
    },
    onSettled: settle,
  });

  return { log, remove };
}

type LocalChange = NonNullable<Parameters<typeof runCommand>[2]>;
