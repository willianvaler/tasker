import { useQuery } from '@tanstack/react-query';

import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, myFolderIds, TASK_WITH_PAGE_SQL, toTaskWithPage } from '../sync/local';
import type { TaskWithPage } from './tasks';

// Tela de etiquetas (OB4, D289): junta as etiquetas das tarefas (labels) e das anotações (tags).
// As das tarefas vêm só das minhas pastas (filtro seletivo, D70); as recebidas ficam de fora.

/** As listas de etiquetas das tarefas abertas que têm alguma */
export function useTaskLabelSets() {
  return useQuery({
    queryKey: ['tasks', 'label-sets'],
    networkMode: isLocal() ? 'always' : 'online',
    staleTime: 30_000,
    queryFn: async (): Promise<string[][]> => {
      if (isLocal()) {
        const rows = await db.getAll<{ labels: string }>(
          `select t.labels from tasks t join folders own_folder on own_folder.id = t.folder_id
            where t.status != 'done' and t.labels is not null and t.labels != '[]'`,
        );
        return rows.map((r) => JSON.parse(r.labels) as string[]);
      }
      const { data, error } = await supabase
        .from('tasks')
        .select('labels')
        .in('folder_id', await myFolderIds())
        .neq('status', 'done')
        .filter('labels', 'neq', '{}')
        .limit(5000);
      if (error) throw error;
      return data.map((r) => r.labels);
    },
  });
}

/** Tarefas abertas com a etiqueta (as das tarefas não têm "/", então é a etiqueta exata) */
export function useTasksWithTag(tag: string | null) {
  return useQuery({
    queryKey: ['tasks', 'tag', tag],
    enabled: !!tag,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<TaskWithPage[]> => {
      if (isLocal()) {
        const rows = await db.getAll<Record<string, unknown>>(
          `${TASK_WITH_PAGE_SQL} where t.status != 'done'
             and exists (select 1 from json_each(t.labels) where value = ?)
           order by t.due_date is null, t.due_date, t.priority desc, t.position limit 200`,
          [tag],
        );
        return rows.map(toTaskWithPage);
      }
      const { data, error } = await supabase
        .from('tasks')
        .select('*, page:pages(name, icon, view_type)')
        .in('folder_id', await myFolderIds())
        .neq('status', 'done')
        .contains('labels', [tag ?? ''])
        .order('due_date', { nullsFirst: false })
        .order('priority', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as TaskWithPage[];
    },
  });
}
