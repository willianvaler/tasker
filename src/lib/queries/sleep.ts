import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addDays } from '../parser/dates';
import { SLEEP_GOAL_DEFAULT, type SleepLog } from '../sleep';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, sessionUserId } from '../sync/local';

/**
 * Sono (SA1, D384): dado de saúde, só com o consentimento `health`. Como a água: lê e grava no
 * aparelho depois da primeira sincronização; a tela usa os últimos 7 dias.
 */
export type SleepData = { goal: number; saved: boolean; logs: SleepLog[] };

const KEY = ['sleep'] as const;
const COLS = 'id, day, bed_time, wake_time';

export function useSleep(today: string) {
  const since = addDays(today, -6);
  return useQuery({
    queryKey: [...KEY, today],
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<SleepData> => {
      const userId = await sessionUserId();
      if (!userId) return { goal: SLEEP_GOAL_DEFAULT, saved: false, logs: [] };
      let row: { sleep_goal_min: number | null } | null;
      let logs: SleepLog[];
      if (isLocal()) {
        [row, logs] = await Promise.all([
          db.getOptional<{ sleep_goal_min: number | null }>(
            'select sleep_goal_min from health_settings where id = ?',
            [userId],
          ),
          db.getAll<SleepLog>(
            `select ${COLS} from sleep_logs where user_id = ? and day >= ? order by day, bed_time`,
            [userId, since],
          ),
        ]);
      } else {
        const [s, l] = await Promise.all([
          supabase.from('health_settings').select('sleep_goal_min').eq('id', userId).maybeSingle(),
          supabase
            .from('sleep_logs')
            .select(COLS)
            .eq('user_id', userId)
            .gte('day', since)
            .order('day')
            .order('bed_time'),
        ]);
        if (s.error) throw s.error;
        if (l.error) throw l.error;
        row = s.data;
        logs = (l.data ?? []) as SleepLog[];
      }
      return { goal: row?.sleep_goal_min ?? SLEEP_GOAL_DEFAULT, saved: !!row, logs };
    },
  });
}

export function useSleepActions(today: string) {
  const queryClient = useQueryClient();
  const key = [...KEY, today];
  const settle = () => {
    void queryClient.invalidateQueries({ queryKey: KEY });
    void queryClient.invalidateQueries({ queryKey: ['water'] });
  };
  const patch = (update: (d: SleepData) => SleepData) =>
    queryClient.setQueryData<SleepData>(key, (d) => (d ? update(d) : d));

  const add = useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async (log: SleepLog) => {
      if (isLocal()) {
        await db.execute(
          'insert into sleep_logs (id, user_id, day, bed_time, wake_time, created_at) values (?, ?, ?, ?, ?, ?)',
          [
            log.id,
            await sessionUserId(),
            log.day,
            log.bed_time,
            log.wake_time,
            new Date().toISOString(),
          ],
        );
        return;
      }
      const { error } = await supabase.from('sleep_logs').insert(log);
      if (error) throw error;
    },
    onMutate: (log) => patch((d) => ({ ...d, logs: [...d.logs, log] })),
    onSettled: settle,
  });

  const remove = useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async (id: string) => {
      if (isLocal()) {
        await db.execute('delete from sleep_logs where id = ?', [id]);
        return;
      }
      const { error } = await supabase.from('sleep_logs').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) => patch((d) => ({ ...d, logs: d.logs.filter((l) => l.id !== id) })),
    onSettled: settle,
  });

  const saveGoal = useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async ({ goal, saved }: { goal: number; saved: boolean }) => {
      const userId = await sessionUserId();
      if (!userId) return;
      if (isLocal()) {
        const now = new Date().toISOString();
        await db.execute(
          saved
            ? 'update health_settings set sleep_goal_min = ?, updated_at = ? where id = ?'
            : 'insert into health_settings (sleep_goal_min, updated_at, id) values (?, ?, ?)',
          [goal, now, userId],
        );
        return;
      }
      const { error } = saved
        ? await supabase.from('health_settings').update({ sleep_goal_min: goal }).eq('id', userId)
        : await supabase.from('health_settings').insert({ id: userId, sleep_goal_min: goal });
      if (error) throw error;
    },
    onMutate: ({ goal }) => patch((d) => ({ ...d, goal, saved: true })),
    onSettled: settle,
  });

  return { add, remove, saveGoal };
}
