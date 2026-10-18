import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, myFolderIds, toTask } from '../sync/local';
import { webUrl } from './projects';
import type { Task } from './tasks';

// Calendário (C1): as tarefas com data que podem cair no intervalo e o link do feed .ics.

/**
 * Tarefas de primeiro nível com data, de todas as pastas da pessoa, que podem aparecer entre
 * `from` e `to`: as que vencem no intervalo e as recorrentes que começaram antes dele. A chave
 * começa com 'tasks' para a atualização otimista (marcar, mudar a data) valer aqui também.
 */
export function useCalendarTasks(from: string, to: string) {
  return useQuery({
    queryKey: ['tasks', 'calendar', from, to],
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<Task[]> => {
      if (isLocal()) {
        // O join com a pasta deixa de fora as páginas recebidas (a pasta não está no aparelho)
        const rows = await db.getAll<Record<string, unknown>>(
          `select t.* from tasks t join folders own_folder on own_folder.id = t.folder_id
           where t.parent_task_id is null and t.due_date is not null and t.due_date <= ?
             and (t.due_date >= ? or t.recurrence is not null)
           order by t.priority desc, t.position`,
          [to, from],
        );
        return rows.map(toTask);
      }
      const folders = await myFolderIds();
      if (!folders.length) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .in('folder_id', folders)
        .is('parent_task_id', null)
        .lte('due_date', to)
        .or(`due_date.gte.${from},recurrence.not.is.null`)
        .order('priority', { ascending: false })
        .order('position');
      if (error) throw error;
      return data;
    },
  });
}

const FEED_KEY = ['calendar-feed'] as const;

/** Endereço do feed para assinar no app de calendário. */
export const feedUrl = (token: string) => webUrl(`/calendario/${token}.ics`);

/**
 * Adicionar por URL no Google Agenda. O Google pede o endereço como webcal:// e busca por https.
 */
export const googleCalendarUrl = (url: string) =>
  `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(url.replace(/^https?:/, 'webcal:'))}`;

/** Token do feed (null: desligado). Só online: o link é do servidor. */
export function useCalendarFeed() {
  return useQuery({
    queryKey: FEED_KEY,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.from('calendar_feeds').select('token').maybeSingle();
      if (error) throw error;
      return data?.token ?? null;
    },
  });
}

export function useCalendarFeedActions() {
  const queryClient = useQueryClient();
  const set = (token: string | null) => queryClient.setQueryData(FEED_KEY, token);
  return {
    /** Liga o feed ou, com `rotate`, troca o link (o antigo para de valer). */
    link: useMutation({
      mutationFn: async (rotate: boolean) => {
        const { data, error } = await supabase.rpc('calendar_feed_link', { p_rotate: rotate });
        if (error) throw error;
        return data;
      },
      onSuccess: set,
    }),
    off: useMutation({
      mutationFn: async () => {
        const { error } = await supabase.rpc('calendar_feed_off');
        if (error) throw error;
      },
      onSuccess: () => set(null),
    }),
  };
}
