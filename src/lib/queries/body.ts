import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, sessionUserId } from '../sync/local';
import { uuidv7 } from '../uuid';

// Peso e medidas (AC7, D239): dado sensível, só da pessoa. Gravar exige o consentimento
// específico (o banco recusa sem ele); revogar apaga tudo. Peso em kg, gordura em %, medidas em cm.

export const BODY_KINDS = [
  'weight',
  'body_fat',
  'waist',
  'chest',
  'hips',
  'arm',
  'thigh',
  'calf',
  'neck',
] as const;
export type BodyKind = (typeof BODY_KINDS)[number];

export type BodyMetric = {
  id: string;
  kind: BodyKind;
  value: number;
  measured_on: string;
  note: string | null;
};
export type BodyGoal = { id: string; kind: BodyKind; target: number };
export type BodyData = { consent: boolean; metrics: BodyMetric[]; goals: BodyGoal[] };

const KEY = ['body'] as const;

/** Tudo de uma vez: são poucos registros por pessoa. Só JSON (vai para o cache). */
export function useBody() {
  return useQuery({
    queryKey: KEY,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<BodyData> => {
      const userId = await sessionUserId();
      if (!userId) return { consent: false, metrics: [], goals: [] };
      if (isLocal()) {
        const [consent, metrics, goals] = await Promise.all([
          db.getOptional<{ id: string }>(
            `select id from sensitive_consents where user_id = ? and purpose = 'body_metrics' and revoked_at is null`,
            [userId],
          ),
          db.getAll<BodyMetric>(
            'select id, kind, value, measured_on, note from body_metrics where user_id = ? order by measured_on, created_at',
            [userId],
          ),
          db.getAll<BodyGoal>('select id, kind, target from body_goals where user_id = ?', [
            userId,
          ]),
        ]);
        return { consent: !!consent, metrics: metrics.map(numeric), goals: goals.map(numericGoal) };
      }
      const [consent, metrics, goals] = await Promise.all([
        supabase.rpc('has_sensitive_consent', { p_purpose: 'body_metrics' }),
        supabase
          .from('body_metrics')
          .select('id, kind, value, measured_on, note')
          .eq('user_id', userId)
          .order('measured_on')
          .order('created_at'),
        supabase.from('body_goals').select('id, kind, target').eq('user_id', userId),
      ]);
      if (consent.error) throw consent.error;
      if (metrics.error) throw metrics.error;
      if (goals.error) throw goals.error;
      return {
        consent: consent.data === true,
        metrics: (metrics.data ?? []).map((m) => numeric(m as BodyMetric)),
        goals: (goals.data ?? []).map((g) => numericGoal(g as BodyGoal)),
      };
    },
  });
}

const numeric = (m: BodyMetric): BodyMetric => ({ ...m, value: Number(m.value) });
const numericGoal = (g: BodyGoal): BodyGoal => ({ ...g, target: Number(g.target) });

export function useBodyActions() {
  const queryClient = useQueryClient();
  const settle = () => queryClient.invalidateQueries({ queryKey: KEY });
  const patch = (update: (data: BodyData) => BodyData) =>
    queryClient.setQueryData<BodyData>(KEY, (data) => (data ? update(data) : data));

  // O consentimento é ato da pessoa no servidor (com data): precisa de conexão
  const consent = useMutation({
    mutationFn: async (give: boolean) => {
      const { error } = await supabase.rpc(
        give ? 'grant_sensitive_consent' : 'revoke_sensitive_consent',
        { p_purpose: 'body_metrics' },
      );
      if (error) throw error;
    },
    onSuccess: (_r, give) =>
      patch((d) => (give ? { ...d, consent: true } : { consent: false, metrics: [], goals: [] })),
    onSettled: settle,
  });

  const add = useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async (m: Omit<BodyMetric, 'id'> & { id: string }) => {
      if (isLocal()) {
        const userId = await sessionUserId();
        await db.execute(
          `insert into body_metrics (id, user_id, kind, value, measured_on, note, created_at)
           values (?, ?, ?, ?, ?, ?, ?)`,
          [m.id, userId, m.kind, m.value, m.measured_on, m.note, new Date().toISOString()],
        );
        return;
      }
      const { error } = await supabase.from('body_metrics').insert(m);
      if (error) throw error;
    },
    onMutate: (m) => patch((d) => ({ ...d, metrics: [...d.metrics, m] })),
    onSettled: settle,
  });

  const remove = useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async (id: string) => {
      if (isLocal()) {
        await db.execute('delete from body_metrics where id = ?', [id]);
        return;
      }
      const { error } = await supabase.from('body_metrics').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) => patch((d) => ({ ...d, metrics: d.metrics.filter((m) => m.id !== id) })),
    onSettled: settle,
  });

  /** Meta de um tipo: muda a que existe, cria se não há, apaga com null. */
  const setGoal = useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async ({ kind, target }: { kind: BodyKind; target: number | null }) => {
      const existing = queryClient.getQueryData<BodyData>(KEY)?.goals.find((g) => g.kind === kind);
      if (isLocal()) {
        const userId = await sessionUserId();
        if (target == null) {
          if (existing) await db.execute('delete from body_goals where id = ?', [existing.id]);
        } else if (existing)
          await db.execute('update body_goals set target = ? where id = ?', [target, existing.id]);
        else
          await db.execute(
            'insert into body_goals (id, user_id, kind, target, updated_at) values (?, ?, ?, ?, ?)',
            [uuidv7(), userId, kind, target, new Date().toISOString()],
          );
        return;
      }
      if (target == null) {
        if (!existing) return;
        const { error } = await supabase.from('body_goals').delete().eq('id', existing.id);
        if (error) throw error;
        return;
      }
      const { error } = existing
        ? await supabase.from('body_goals').update({ target }).eq('id', existing.id)
        : await supabase.from('body_goals').insert({ id: uuidv7(), kind, target });
      if (error) throw error;
    },
    onSettled: settle,
  });

  return { consent, add, remove, setGoal };
}

export const newBodyId = () => uuidv7();
