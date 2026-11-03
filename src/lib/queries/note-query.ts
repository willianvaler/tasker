import { useQuery } from '@tanstack/react-query';

import { addDays } from '../parser/dates';
import type { FetchPlan } from '../query/run';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, myFolderIds, TASK_WITH_PAGE_SQL, toTaskWithPage } from '../sync/local';
import type { TaskWithPage } from './tasks';

// Consulta ```questlist das anotações (OB7, D292): lê as tarefas pelo filtro seletivo do plano
// (lista, pasta, etiqueta ou intervalo de datas, D70) e o executor puro (lib/query/run.ts) filtra
// o resto. Com o banco no aparelho, lê dele (funciona sem internet, D86). A chave começa com
// 'tasks', para marcar a caixinha atualizar aqui também.

/** Teto de linhas lidas por consulta (o executor ainda corta pelo `limite`) */
const READ_LIMIT = 1000;

export function useQueryTasks(plan: FetchPlan | null) {
  return useQuery({
    queryKey: ['tasks', 'note-query', plan],
    enabled: !!plan && plan.by !== 'none',
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<TaskWithPage[]> => {
      if (!plan || plan.by === 'none') return [];
      if ((plan.by === 'pages' || plan.by === 'folders') && plan.ids.length === 0) return [];
      if (isLocal()) {
        let where: string;
        let params: unknown[];
        switch (plan.by) {
          case 'pages':
          case 'folders': {
            const column = plan.by === 'pages' ? 't.page_id' : 't.folder_id';
            where = `${column} in (${plan.ids.map(() => '?').join(', ')})`;
            params = plan.ids;
            break;
          }
          case 'tag':
            where = `exists (select 1 from json_each(t.labels) where lower(value) = lower(?))`;
            params = [plan.tag];
            break;
          default: {
            // Datas com folga de um dia (o fuso acerta no executor)
            const column =
              plan.by === 'due'
                ? 't.due_date'
                : plan.by === 'created'
                  ? 'substr(t.created_at, 1, 10)'
                  : 'substr(t.completed_at, 1, 10)';
            const slack = plan.by === 'due' ? 0 : 1;
            const parts: string[] = [`${column} is not null`];
            params = [];
            if (plan.from) {
              parts.push(`${column} >= ?`);
              params.push(addDays(plan.from, -slack));
            }
            if (plan.to) {
              parts.push(`${column} <= ?`);
              params.push(addDays(plan.to, slack));
            }
            where = parts.join(' and ');
          }
        }
        const rows = await db.getAll<Record<string, unknown>>(
          `${TASK_WITH_PAGE_SQL} where ${where} order by t.position limit ${READ_LIMIT}`,
          params,
        );
        return rows.map(toTaskWithPage);
      }
      let request = supabase.from('tasks').select('*, page:pages(name, icon, view_type)');
      switch (plan.by) {
        case 'pages':
          request = request.in('page_id', plan.ids);
          break;
        case 'folders':
          request = request.in('folder_id', plan.ids);
          break;
        case 'tag':
          request = request.in('folder_id', await myFolderIds()).contains('labels', [plan.tag]);
          break;
        default: {
          const column =
            plan.by === 'due' ? 'due_date' : plan.by === 'created' ? 'created_at' : 'completed_at';
          const slack = plan.by === 'due' ? 0 : 1;
          request = request.in('folder_id', await myFolderIds()).not(column, 'is', null);
          if (plan.from) request = request.gte(column, addDays(plan.from, -slack));
          if (plan.to)
            request =
              plan.by === 'due'
                ? request.lte(column, plan.to)
                : request.lt(column, addDays(plan.to, slack + 1));
        }
      }
      const { data, error } = await request.order('position').limit(READ_LIMIT);
      if (error) throw error;
      return data as TaskWithPage[];
    },
  });
}
