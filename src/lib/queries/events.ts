import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { supabase } from '../supabase';
import type { TaskEvent } from '../task-events';
import { keys } from './keys';

const SELECT = '*, actor:profiles(display_name)';
export const EVENTS_PAGE = 200;

/** Histórico de uma tarefa (aba Histórico). Só online: a auditoria fica no servidor. */
export function useTaskEvents(taskId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: keys.taskEvents(taskId ?? ''),
    enabled: !!taskId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_events')
        .select(SELECT)
        .eq('task_id', taskId ?? '')
        .order('at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as TaskEvent[];
    },
  });
}

export type EventFilters = { userId?: string; kind?: string; since?: string };

/** Linha do tempo do projeto, filtrável por pessoa, tipo e período, de 200 em 200. */
export function useProjectEvents(
  rootId: string | undefined,
  filters: EventFilters,
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: [...keys.projectEvents(rootId ?? ''), filters],
    enabled: !!rootId && enabled,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from('task_events')
        .select(SELECT)
        .eq('root_id', rootId ?? '')
        .order('at', { ascending: false })
        .limit(EVENTS_PAGE);
      if (filters.userId) query = query.eq('user_id', filters.userId);
      if (filters.kind) query = query.eq('kind', filters.kind);
      if (filters.since) query = query.gte('at', filters.since);
      if (pageParam) query = query.lt('at', pageParam);
      const { data, error } = await query;
      if (error) throw error;
      return data as TaskEvent[];
    },
    getNextPageParam: (last) => (last.length === EVENTS_PAGE ? last[last.length - 1].at : null),
  });
}
