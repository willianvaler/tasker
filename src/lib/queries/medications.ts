import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addDays } from '../parser/dates';
import { slotText, type Intake, type Medication } from '../medications';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, sessionUserId } from '../sync/local';
import { uuidv7 } from '../uuid';

// Remédios do Bem-estar (BE4, D270): dado de saúde, só da pessoa. Gravar exige o consentimento
// específico 'medications' (o banco recusa sem ele); revogar apaga tudo. O saldo é do app
// (lib/medications.ts), a partir da última contagem.

export type MedicationData = { consent: boolean; list: Medication[]; intakes: Intake[] };
type Fields = Omit<Medication, 'id'>;

const KEY = ['medications'] as const;
const COLUMNS =
  'id, name, dose, times_per_day, every_days, pack_size, stock, stock_on, paused, notes, dose_times, weekdays, show_name';
const INTAKE_COLUMNS = 'id, medication_id, day, slot, status, snoozes, snoozed_until, acted_at';
/** Quantos dias de histórico a tela carrega */
export const HISTORY_DAYS = 30;

const list = (v: unknown): unknown[] =>
  Array.isArray(v) ? v : typeof v === 'string' && v.startsWith('[') ? JSON.parse(v) : [];

const normalize = (m: Medication): Medication => ({
  ...m,
  dose: Number(m.dose),
  stock: Number(m.stock),
  times_per_day: Number(m.times_per_day),
  every_days: Number(m.every_days),
  pack_size: m.pack_size == null ? null : Number(m.pack_size),
  paused: !!m.paused,
  dose_times: list(m.dose_times).map((x) => slotText(String(x))),
  weekdays: list(m.weekdays).map(Number),
  show_name: !!m.show_name,
});

const normalizeIntake = (i: Intake): Intake => ({
  ...i,
  slot: slotText(i.slot),
  snoozes: Number(i.snoozes),
});

/** Grava Tomei, Pular ou Adiar (upsert pelo id calculado). Também usado pelos botões do aviso. */
export async function saveIntake(intake: Intake) {
  if (isLocal()) {
    // As tabelas do PowerSync são views: sem upsert, então atualiza ou insere
    const userId = await sessionUserId();
    await db.writeTransaction(async (tx) => {
      const found = await tx.getOptional<{ id: string }>(
        'select id from medication_intakes where id = ?',
        [intake.id],
      );
      if (found) {
        await tx.execute(
          `update medication_intakes set status = ?, snoozes = ?, snoozed_until = ?, acted_at = ?
           where id = ?`,
          [intake.status, intake.snoozes, intake.snoozed_until, intake.acted_at, intake.id],
        );
      } else {
        await tx.execute(
          `insert into medication_intakes (id, user_id, medication_id, day, slot, status, snoozes,
             snoozed_until, acted_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            intake.id,
            userId,
            intake.medication_id,
            intake.day,
            `${intake.slot}:00`,
            intake.status,
            intake.snoozes,
            intake.snoozed_until,
            intake.acted_at,
          ],
        );
      }
    });
    return;
  }
  // Sem upsert: o update não pode mexer no remédio, no dia nem no horário (privilégio por coluna)
  const { status, snoozes, snoozed_until, acted_at } = intake;
  const updated = await supabase
    .from('medication_intakes')
    .update({ status, snoozes, snoozed_until, acted_at })
    .eq('id', intake.id)
    .select('id');
  if (updated.error) throw updated.error;
  if (updated.data.length > 0) return;
  const { error } = await supabase.from('medication_intakes').insert(intake);
  if (error) throw error;
}

async function deleteIntake(id: string) {
  if (isLocal()) {
    await db.execute('delete from medication_intakes where id = ?', [id]);
    return;
  }
  const { error } = await supabase.from('medication_intakes').delete().eq('id', id);
  if (error) throw error;
}

/** Todos de uma vez: são poucos por pessoa. Só JSON (vai para o cache). */
export function useMedications(today: string) {
  const since = addDays(today, -HISTORY_DAYS);
  return useQuery({
    queryKey: KEY,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<MedicationData> => {
      const userId = await sessionUserId();
      if (!userId) return { consent: false, list: [], intakes: [] };
      if (isLocal()) {
        const [consent, list, intakes] = await Promise.all([
          db.getOptional<{ id: string }>(
            `select id from sensitive_consents where user_id = ? and purpose = 'medications' and revoked_at is null`,
            [userId],
          ),
          db.getAll<Medication>(
            `select ${COLUMNS} from medications where user_id = ? order by created_at`,
            [userId],
          ),
          db.getAll<Intake>(
            `select ${INTAKE_COLUMNS} from medication_intakes where user_id = ? and day >= ?
             order by day, slot`,
            [userId, since],
          ),
        ]);
        // Antes de a linha do consentimento descer, pergunta ao servidor (como a água, D383)
        const given =
          !!consent ||
          (await supabase.rpc('has_sensitive_consent', { p_purpose: 'medications' }).then(
            (r) => r.data === true,
            () => false,
          ));
        return {
          consent: given,
          list: list.map(normalize),
          intakes: intakes.map(normalizeIntake),
        };
      }
      const [consent, list, intakes] = await Promise.all([
        supabase.rpc('has_sensitive_consent', { p_purpose: 'medications' }),
        supabase.from('medications').select(COLUMNS).eq('user_id', userId).order('created_at'),
        supabase
          .from('medication_intakes')
          .select(INTAKE_COLUMNS)
          .eq('user_id', userId)
          .gte('day', since)
          .order('day')
          .order('slot'),
      ]);
      if (consent.error) throw consent.error;
      if (list.error) throw list.error;
      if (intakes.error) throw intakes.error;
      return {
        consent: consent.data === true,
        list: (list.data ?? []).map((m) => normalize(m as unknown as Medication)),
        intakes: (intakes.data ?? []).map((i) => normalizeIntake(i as Intake)),
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
      patch((d) => (give ? { ...d, consent: true } : { consent: false, list: [], intakes: [] })),
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
             stock, stock_on, paused, notes, dose_times, weekdays, show_name, created_at, updated_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            JSON.stringify(m.dose_times.map((x) => `${x}:00`)),
            JSON.stringify(m.weekdays),
            Number(m.show_name),
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
          ([k, v]) =>
            [
              k,
              typeof v === 'boolean'
                ? Number(v)
                : Array.isArray(v)
                  ? JSON.stringify(k === 'dose_times' ? v.map((x) => `${x}:00`) : v)
                  : (v ?? null),
            ] as const,
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

  // Tomei, Pular, Adiar (SA3): offline, pelo id calculado; desfazer apaga a linha
  // Em fila (scope): o segundo Adiar só grava depois do primeiro, senão os dois inserem a mesma linha
  const record = useMutation({
    scope: { id: 'medication-intake' },
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: saveIntake,
    // Uma leitura em voo apagaria o otimista (e o próximo Adiar contaria do zero)
    onMutate: async (intake) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      patch((d) => ({
        ...d,
        intakes: [...d.intakes.filter((i) => i.id !== intake.id), intake],
      }));
    },
    onSettled: settle,
  });
  const undo = useMutation({
    scope: { id: 'medication-intake' },
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: deleteIntake,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      patch((d) => ({ ...d, intakes: d.intakes.filter((i) => i.id !== id) }));
    },
    onSettled: settle,
  });

  return { consent, add, update, remove, record, undo };
}

export const newMedicationId = () => uuidv7();
