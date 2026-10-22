import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Medication } from '../medications';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, sessionUserId } from '../sync/local';
import { uuidv7 } from '../uuid';

// Remédios do Bem-estar (BE4, D270): dado de saúde, só da pessoa. Gravar exige o consentimento
// específico 'medications' (o banco recusa sem ele); revogar apaga tudo. O saldo é do app
// (lib/medications.ts), a partir da última contagem.

export type MedicationData = { consent: boolean; list: Medication[] };
type Fields = Omit<Medication, 'id'>;

const KEY = ['medications'] as const;
const COLUMNS =
  'id, name, dose, times_per_day, every_days, pack_size, stock, stock_on, paused, notes';

const normalize = (m: Medication): Medication => ({
  ...m,
  dose: Number(m.dose),
  stock: Number(m.stock),
  times_per_day: Number(m.times_per_day),
  every_days: Number(m.every_days),
  pack_size: m.pack_size == null ? null : Number(m.pack_size),
  paused: !!m.paused,
});

/** Todos de uma vez: são poucos por pessoa. Só JSON (vai para o cache). */
export function useMedications() {
  return useQuery({
    queryKey: KEY,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<MedicationData> => {
      const userId = await sessionUserId();
      if (!userId) return { consent: false, list: [] };
      if (isLocal()) {
        const [consent, list] = await Promise.all([
          db.getOptional<{ id: string }>(
            `select id from sensitive_consents where user_id = ? and purpose = 'medications' and revoked_at is null`,
            [userId],
          ),
          db.getAll<Medication>(
            `select ${COLUMNS} from medications where user_id = ? order by created_at`,
            [userId],
          ),
        ]);
        return { consent: !!consent, list: list.map(normalize) };
      }
      const [consent, list] = await Promise.all([
        supabase.rpc('has_sensitive_consent', { p_purpose: 'medications' }),
        supabase.from('medications').select(COLUMNS).eq('user_id', userId).order('created_at'),
      ]);
      if (consent.error) throw consent.error;
      if (list.error) throw list.error;
      return {
        consent: consent.data === true,
        list: (list.data ?? []).map((m) => normalize(m as Medication)),
      };
    },
  });
}

export function useMedicationActions() {
  const queryClient = useQueryClient();
  const settle = () => queryClient.invalidateQueries({ queryKey: KEY });
  const patch = (update: (data: MedicationData) => MedicationData) =>
    queryClient.setQueryData<MedicationData>(KEY, (data) => (data ? update(data) : data));

  // O consentimento é ato da pessoa no servidor (com data): precisa de conexão
  const consent = useMutation({
    mutationFn: async (give: boolean) => {
      const { error } = await supabase.rpc(
        give ? 'grant_sensitive_consent' : 'revoke_sensitive_consent',
        { p_purpose: 'medications' },
      );
      if (error) throw error;
    },
    onSuccess: (_r, give) =>
      patch((d) => (give ? { ...d, consent: true } : { consent: false, list: [] })),
    onSettled: settle,
  });

  const add = useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async (m: Medication) => {
      if (isLocal()) {
        const userId = await sessionUserId();
        const now = new Date().toISOString();
        await db.execute(
          `insert into medications (id, user_id, name, dose, times_per_day, every_days, pack_size,
             stock, stock_on, paused, notes, created_at, updated_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            m.id,
            userId,
            m.name,
            m.dose,
            m.times_per_day,
            m.every_days,
            m.pack_size,
            m.stock,
            m.stock_on,
            Number(m.paused),
            m.notes,
            now,
            now,
          ],
        );
        return;
      }
      const { error } = await supabase.from('medications').insert(m);
      if (error) throw error;
    },
    onMutate: (m) => patch((d) => ({ ...d, list: [...d.list, m] })),
    onSettled: settle,
  });

  const update = useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async ({ id, fields }: { id: string; fields: Partial<Fields> }) => {
      if (isLocal()) {
        const entries = Object.entries(fields).map(
          ([k, v]) => [k, typeof v === 'boolean' ? Number(v) : (v ?? null)] as const,
        );
        await db.execute(
          `update medications set ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ? where id = ?`,
          [...entries.map(([, v]) => v), new Date().toISOString(), id],
        );
        return;
      }
      const { error } = await supabase.from('medications').update(fields).eq('id', id);
      if (error) throw error;
    },
    onMutate: ({ id, fields }) =>
      patch((d) => ({ ...d, list: d.list.map((m) => (m.id === id ? { ...m, ...fields } : m)) })),
    onSettled: settle,
  });

  const remove = useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async (id: string) => {
      if (isLocal()) {
        await db.execute('delete from medications where id = ?', [id]);
        return;
      }
      const { error } = await supabase.from('medications').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) => patch((d) => ({ ...d, list: d.list.filter((m) => m.id !== id) })),
    onSettled: settle,
  });

  return { consent, add, update, remove };
}

export const newMedicationId = () => uuidv7();
