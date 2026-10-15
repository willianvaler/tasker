import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Json, Tables } from '../db';
import { DEFAULT_POMODORO, type PomodoroSettings } from '../pomodoro';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal } from '../sync/local';
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
