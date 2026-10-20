import { useQuery } from '@tanstack/react-query';

import { supabase } from '../supabase';
import { db } from '../sync/db';
import {
  isLocal,
  myFolderIds,
  sessionUserId,
  TASK_WITH_PAGE_SQL,
  toTaskWithPage,
} from '../sync/local';
import type { DoneItem } from '../weekly-review';
import type { TaskWithPage } from './tasks';

// Revisão semanal (PB3, D223). Lê do aparelho depois da primeira sincronização, como a Hoje.

const TASK_WITH_PAGE = '*, page:pages(name, icon, view_type)';

export type WeekDone = DoneItem & { view_type: string | null };

/** O que concluí desde `since` (uma linha por conclusão; repetidas aparecem várias vezes). */
export function useWeekDone(since: string) {
  return useQuery({
    queryKey: ['tasks', 'review-done', since],
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<WeekDone[]> => {
      const me = await sessionUserId();
      if (!me) return [];
      if (isLocal()) {
        return db.getAll<WeekDone>(
          `select c.task_id, t.title, p.name as page, p.view_type from task_completions c
           join tasks t on t.id = c.task_id left join pages p on p.id = t.page_id
           where c.user_id = ? and c.completed_at >= ? order by c.completed_at`,
          [me, since],
        );
      }
      const { data, error } = await supabase
        .from('task_completions')
        .select('task_id, task:tasks(title, page:pages(name, view_type))')
        .eq('user_id', me)
        .gte('completed_at', since)
        .order('completed_at');
      if (error) throw error;
      return data.flatMap((c) =>
        c.task
          ? [
              {
                task_id: c.task_id,
                title: c.task.title,
                page: c.task.page?.name ?? null,
                view_type: c.task.page?.view_type ?? null,
              },
            ]
          : [],
      );
    },
  });
}

/** Abertas, sem data, de lista ou kanban, sem mexer desde `before`: candidatas a arquivar. */
export function useStaleTasks(before: string) {
  return useQuery({
    queryKey: ['tasks', 'review-stale', before],
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<TaskWithPage[]> => {
      if (isLocal()) {
        const rows = await db.getAll<Record<string, unknown>>(
          `${TASK_WITH_PAGE_SQL} where t.parent_task_id is null and t.status != 'done'
             and t.due_date is null and t.updated_at < ? and p.view_type in ('list', 'kanban')
           order by t.updated_at limit 50`,
          [before],
        );
        return rows.map(toTaskWithPage);
      }
      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_WITH_PAGE)
        .in('folder_id', await myFolderIds())
        .is('parent_task_id', null)
        .neq('status', 'done')
        .is('due_date', null)
        .lt('updated_at', before)
        .order('updated_at')
        .limit(50);
      if (error) throw error;
      return (data as TaskWithPage[]).filter(
        (t) => t.page?.view_type === 'list' || t.page?.view_type === 'kanban',
      );
    },
  });
}
