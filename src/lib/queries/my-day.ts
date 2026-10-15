import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, localInsert, localUpdate, sessionUserId, toTask } from '../sync/local';
import { uuidv7 } from '../uuid';
import type { Task } from './tasks';

// Meu dia (M4, D141): as tarefas que a pessoa escolheu para o dia, na ordem dela.

export type MyDayItem = { id: string; position: number; task: Task };
const myDayKey = (day: string) => ['my-day', day] as const;

export function useMyDay(day: string) {
  return useQuery({
    queryKey: myDayKey(day),
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<MyDayItem[]> => {
      const userId = await sessionUserId();
      if (!userId) return [];
      if (isLocal()) {
        const rows = await db.getAll<Record<string, unknown>>(
          `select t.*, m.id as my_day_id, m.position as my_day_position
           from my_day m join tasks t on t.id = m.task_id
           where m.user_id = ? and m.day = ? order by m.position`,
          [userId, day],
        );
        return rows.map(({ my_day_id, my_day_position, ...task }) => ({
          id: my_day_id as string,
          position: my_day_position as number,
          task: toTask(task),
        }));
      }
      const { data, error } = await supabase
        .from('my_day')
        .select('id, position, task:tasks(*)')
        .eq('user_id', userId)
        .eq('day', day)
        .order('position');
      if (error) throw error;
      return data
        .filter((r) => r.task)
        .map((r) => ({ id: r.id, position: r.position, task: r.task as Task }));
    },
  });
}

export function useMyDayActions(day: string) {
  const queryClient = useQueryClient();
  const settle = () => queryClient.invalidateQueries({ queryKey: myDayKey(day) });
  const networkMode = isLocal() ? ('always' as const) : ('online' as const);
  const list = () => queryClient.getQueryData<MyDayItem[]>(myDayKey(day)) ?? [];

  const add = useMutation({
    networkMode,
    mutationFn: async (taskId: string) => {
      const position = Math.max(0, ...list().map((i) => i.position)) + 1;
      const row = { id: uuidv7(), task_id: taskId, day, position };
      if (isLocal()) {
        const userId = await sessionUserId();
        await localInsert('my_day', {
          ...row,
          user_id: userId,
          created_at: new Date().toISOString(),
        });
        return;
      }
      const { error } = await supabase.from('my_day').insert(row);
      if (error) throw error;
    },
    onSettled: settle,
  });

  const remove = useMutation({
    networkMode,
    mutationFn: async (id: string) => {
      if (isLocal()) {
        await db.execute('delete from my_day where id = ?', [id]);
        return;
      }
      const { error } = await supabase.from('my_day').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: settle,
  });

  /** Troca de lugar com o vizinho (−1 sobe, +1 desce). */
  const move = useMutation({
    networkMode,
    mutationFn: async ({ id, delta }: { id: string; delta: -1 | 1 }) => {
      const items = list();
      const i = items.findIndex((x) => x.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= items.length) return;
      const [a, b] = [items[i], items[j]];
      for (const [row, position] of [
        [a, b.position],
        [b, a.position],
      ] as const) {
        if (isLocal()) await localUpdate('my_day', row.id, { position });
        else {
          const { error } = await supabase.from('my_day').update({ position }).eq('id', row.id);
          if (error) throw error;
        }
      }
    },
    onMutate: async ({ id, delta }) => {
      await queryClient.cancelQueries({ queryKey: myDayKey(day) });
      const before = list();
      const items = [...before];
      const i = items.findIndex((x) => x.id === id);
      const j = i + delta;
      if (i >= 0 && j >= 0 && j < items.length) [items[i], items[j]] = [items[j], items[i]];
      queryClient.setQueryData(myDayKey(day), items);
      return { before };
    },
    onError: (_e, _v, ctx) => queryClient.setQueryData(myDayKey(day), ctx?.before),
    onSettled: settle,
  });

  return { add, remove, move };
}
