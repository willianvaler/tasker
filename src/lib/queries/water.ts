import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addDays } from '../parser/dates';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, sessionUserId } from '../sync/local';
import { uuidv7 } from '../uuid';
import { WATER_DEFAULTS, type WaterLog } from '../water';

/**
 * Água (SA2, D383): dado de saúde, só com o consentimento `health` (o banco recusa sem ele). Lê e
 * grava no aparelho depois da primeira sincronização; os registros dos últimos 7 dias bastam
 * para a tela (o resto fica no servidor e na exportação).
 */
export type WaterSettings = { goal: number; cup: number };
export type WaterData = { settings: WaterSettings; saved: boolean; logs: WaterLog[] };

const KEY = ['water'] as const;
const COLS = 'id, ml, day, logged_at';

export function useWater(today: string) {
  const since = addDays(today, -6);
  return useQuery({
    queryKey: [...KEY, today],
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<WaterData> => {
      const userId = await sessionUserId();
      const empty = { settings: { ...WATER_DEFAULTS }, saved: false, logs: [] };
      if (!userId) return empty;
      let row: { water_goal_ml: number; cup_ml: number } | null;
      let logs: WaterLog[];
      if (isLocal()) {
        [row, logs] = await Promise.all([
          db.getOptional<{ water_goal_ml: number; cup_ml: number }>(
            'select water_goal_ml, cup_ml from health_settings where id = ?',
            [userId],
          ),
          db.getAll<WaterLog>(
            `select ${COLS} from water_logs where user_id = ? and day >= ? order by logged_at`,
            [userId, since],
          ),
        ]);
      } else {
        const [s, l] = await Promise.all([
          supabase
            .from('health_settings')
            .select('water_goal_ml, cup_ml')
            .eq('id', userId)
            .maybeSingle(),
          supabase
            .from('water_logs')
            .select(COLS)
            .eq('user_id', userId)
            .gte('day', since)
            .order('logged_at'),
        ]);
        if (s.error) throw s.error;
        if (l.error) throw l.error;
        row = s.data;
        logs = (l.data ?? []) as WaterLog[];
      }
      return {
        settings: row ? { goal: row.water_goal_ml, cup: row.cup_ml } : { ...WATER_DEFAULTS },
        saved: !!row,
        logs,
      };
    },
  });
}

export function useWaterActions(today: string) {
  const queryClient = useQueryClient();
  const key = [...KEY, today];
  const settle = () => {
    void queryClient.invalidateQueries({ queryKey: KEY });
    void queryClient.invalidateQueries({ queryKey: ['sleep'] });
  };
  const patch = (update: (d: WaterData) => WaterData) =>
    queryClient.setQueryData<WaterData>(key, (d) => (d ? update(d) : d));

  const add = useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async (log: WaterLog) => {
      if (isLocal()) {
        await db.execute(
          'insert into water_logs (id, user_id, ml, day, logged_at, created_at) values (?, ?, ?, ?, ?, ?)',
          [log.id, await sessionUserId(), log.ml, log.day, log.logged_at, log.logged_at],
        );
        return;
      }
      const { error } = await supabase.from('water_logs').insert(log);
      if (error) throw error;
    },
    onMutate: (log) => patch((d) => ({ ...d, logs: [...d.logs, log] })),
    onSettled: settle,
  });

  const remove = useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async (id: string) => {
      if (isLocal()) {
        await db.execute('delete from water_logs where id = ?', [id]);
        return;
      }
      const { error } = await supabase.from('water_logs').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) => patch((d) => ({ ...d, logs: d.logs.filter((l) => l.id !== id) })),
    onSettled: settle,
  });

  const saveSettings = useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async ({ settings, saved }: { settings: WaterSettings; saved: boolean }) => {
      const userId = await sessionUserId();
      if (!userId) return;
      const fields = { water_goal_ml: settings.goal, cup_ml: settings.cup };
      if (isLocal()) {
        const now = new Date().toISOString();
        await db.execute(
          saved
            ? 'update health_settings set water_goal_ml = ?, cup_ml = ?, updated_at = ? where id = ?'
            : 'insert into health_settings (water_goal_ml, cup_ml, updated_at, id) values (?, ?, ?, ?)',
          [settings.goal, settings.cup, now, userId],
        );
        return;
      }
      const { error } = saved
        ? await supabase.from('health_settings').update(fields).eq('id', userId)
        : await supabase.from('health_settings').insert({ id: userId, ...fields });
      if (error) throw error;
    },
    onMutate: ({ settings }) => patch((d) => ({ ...d, settings, saved: true })),
    onSettled: settle,
  });

  /** Um registro novo de agora, no dia de hoje (o do fuso da pessoa). */
  const drink = (ml: number) =>
    add.mutateAsync({ id: uuidv7(), ml, day: today, logged_at: new Date().toISOString() });

  return { add, drink, remove, saveSettings };
}
