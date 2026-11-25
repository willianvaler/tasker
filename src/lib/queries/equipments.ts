import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Equipment, MaintenancePlan } from '../maintenance';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, sessionUserId } from '../sync/local';
import { uuidv7 } from '../uuid';

// Equipamentos e manutenção (CS1, D365): pessoais, com sync. A próxima data e a tarefa aberta de
// cada plano são do servidor (gatilhos de maintenance_plans); a tela mostra o espelho
// (lib/maintenance.ts) enquanto o plano novo não sincronizou.

export type HomeData = { equipments: Equipment[]; plans: MaintenancePlan[] };
type EquipmentFields = Omit<Equipment, 'id' | 'warranty_ends_on'>;
type PlanFields = Pick<
  MaintenancePlan,
  'name' | 'every_n' | 'unit' | 'last_done_on' | 'page_id' | 'paused'
>;

const KEY = ['equipments'] as const;
const E_COLS =
  'id, name, room, brand, model, purchased_on, device_id, notes, warranty_months, warranty_until, expense_id, warranty_ends_on';
const P_COLS =
  'id, equipment_id, name, every_n, unit, last_done_on, page_id, paused, next_on, task_id';

const normPlan = (p: MaintenancePlan): MaintenancePlan => ({
  ...p,
  every_n: Number(p.every_n),
  paused: !!p.paused,
});

/** Tudo de uma vez: são poucos por pessoa. Só JSON (vai para o cache). */
export function useHome() {
  return useQuery({
    queryKey: KEY,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<HomeData> => {
      const userId = await sessionUserId();
      if (!userId) return { equipments: [], plans: [] };
      if (isLocal()) {
        const [equipments, plans] = await Promise.all([
          db.getAll<Equipment>(
            `select ${E_COLS} from equipments where user_id = ? order by name collate nocase`,
            [userId],
          ),
          db.getAll<MaintenancePlan>(
            `select ${P_COLS} from maintenance_plans where user_id = ? order by created_at`,
            [userId],
          ),
        ]);
        return { equipments, plans: plans.map(normPlan) };
      }
      const [equipments, plans] = await Promise.all([
        supabase.from('equipments').select(E_COLS).eq('user_id', userId).order('name'),
        supabase.from('maintenance_plans').select(P_COLS).eq('user_id', userId).order('created_at'),
      ]);
      if (equipments.error) throw equipments.error;
      if (plans.error) throw plans.error;
      return {
        equipments: (equipments.data ?? []) as Equipment[],
        plans: ((plans.data ?? []) as MaintenancePlan[]).map(normPlan),
      };
    },
  });
}

const sqlValue = (v: unknown) => (typeof v === 'boolean' ? Number(v) : (v ?? null));

async function localUpdate(table: string, id: string, fields: Record<string, unknown>) {
  const entries = Object.entries(fields);
  await db.execute(
    `update ${table} set ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ? where id = ?`,
    [...entries.map(([, v]) => sqlValue(v)), new Date().toISOString(), id],
  );
}

export function useHomeActions() {
  const queryClient = useQueryClient();
  const settle = () => queryClient.invalidateQueries({ queryKey: KEY });
  const patch = (update: (data: HomeData) => HomeData) =>
    queryClient.setQueryData<HomeData>(KEY, (data) => (data ? update(data) : data));
  const mode = isLocal() ? ('always' as const) : ('online' as const);

  const addEquipment = useMutation({
    networkMode: mode,
    mutationFn: async (e: Equipment) => {
      if (isLocal()) {
        const userId = await sessionUserId();
        const now = new Date().toISOString();
        await db.execute(
          `insert into equipments (id, user_id, name, room, brand, model, purchased_on, device_id,
             notes, warranty_months, warranty_until, expense_id, created_at, updated_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            e.id,
            userId,
            e.name,
            e.room,
            e.brand,
            e.model,
            e.purchased_on,
            e.device_id,
            e.notes,
            e.warranty_months,
            e.warranty_until,
            e.expense_id,
            now,
            now,
          ],
        );
        return;
      }
      const { warranty_ends_on: _server, ...row } = e;
      const { error } = await supabase.from('equipments').insert(row);
      if (error) throw error;
    },
    onMutate: (e) => patch((d) => ({ ...d, equipments: [...d.equipments, e] })),
    onSettled: settle,
  });

  const updateEquipment = useMutation({
    networkMode: mode,
    mutationFn: async ({ id, fields }: { id: string; fields: Partial<EquipmentFields> }) => {
      if (isLocal()) return localUpdate('equipments', id, fields);
      const { error } = await supabase.from('equipments').update(fields).eq('id', id);
      if (error) throw error;
    },
    onMutate: ({ id, fields }) =>
      patch((d) => ({
        ...d,
        // O fim da garantia é do servidor: some até voltar, e a tela usa a conta local
        equipments: d.equipments.map((e) =>
          e.id === id ? { ...e, ...fields, warranty_ends_on: null } : e,
        ),
      })),
    onSettled: settle,
  });

  const removeEquipment = useMutation({
    networkMode: mode,
    mutationFn: async (id: string) => {
      if (isLocal()) {
        // No aparelho não há cascata: os planos saem juntos (o servidor tira a tarefa aberta)
        await db.writeTransaction(async (tx) => {
          await tx.execute('delete from maintenance_plans where equipment_id = ?', [id]);
          await tx.execute('delete from equipments where id = ?', [id]);
        });
        return;
      }
      const { error } = await supabase.from('equipments').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) =>
      patch((d) => ({
        equipments: d.equipments.filter((e) => e.id !== id),
        plans: d.plans.filter((p) => p.equipment_id !== id),
      })),
    onSettled: settle,
  });

  const addPlan = useMutation({
    networkMode: mode,
    mutationFn: async (p: MaintenancePlan) => {
      const row = {
        id: p.id,
        equipment_id: p.equipment_id,
        name: p.name,
        every_n: p.every_n,
        unit: p.unit,
        last_done_on: p.last_done_on,
        page_id: p.page_id,
        paused: p.paused,
      };
      if (isLocal()) {
        const userId = await sessionUserId();
        const now = new Date().toISOString();
        await db.execute(
          `insert into maintenance_plans (id, user_id, equipment_id, name, every_n, unit, last_done_on,
             page_id, paused, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.id,
            userId,
            row.equipment_id,
            row.name,
            row.every_n,
            row.unit,
            row.last_done_on,
            row.page_id,
            Number(row.paused),
            now,
            now,
          ],
        );
        return;
      }
      const { error } = await supabase.from('maintenance_plans').insert(row);
      if (error) throw error;
    },
    onMutate: (p) => patch((d) => ({ ...d, plans: [...d.plans, p] })),
    // A tarefa nova do plano aparece nas listas
    onSettled: () => {
      void settle();
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const updatePlan = useMutation({
    networkMode: mode,
    mutationFn: async ({ id, fields }: { id: string; fields: Partial<PlanFields> }) => {
      if (isLocal()) return localUpdate('maintenance_plans', id, fields);
      const { error } = await supabase.from('maintenance_plans').update(fields).eq('id', id);
      if (error) throw error;
    },
    onMutate: ({ id, fields }) =>
      patch((d) => ({
        ...d,
        // A próxima data muda no servidor: some até voltar, e a tela usa a conta local
        plans: d.plans.map((p) => (p.id === id ? { ...p, ...fields, next_on: null } : p)),
      })),
    onSettled: () => {
      void settle();
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const removePlan = useMutation({
    networkMode: mode,
    mutationFn: async (id: string) => {
      if (isLocal()) {
        await db.execute('delete from maintenance_plans where id = ?', [id]);
        return;
      }
      const { error } = await supabase.from('maintenance_plans').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) => patch((d) => ({ ...d, plans: d.plans.filter((p) => p.id !== id) })),
    onSettled: () => {
      void settle();
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  return { addEquipment, updateEquipment, removeEquipment, addPlan, updatePlan, removePlan };
}

export type ExpenseOption = {
  id: string;
  description: string;
  amount_cents: number;
  currency: string;
  spent_on: string;
  receipt_path: string | null;
};

/** Os gastos que a pessoa lançou (os últimos 200), para escolher a nota fiscal do equipamento. */
export function useMyExpenses(enabled: boolean) {
  return useQuery({
    queryKey: ['equipments', 'expenses'],
    enabled,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<ExpenseOption[]> => {
      const userId = await sessionUserId();
      if (!userId) return [];
      const cols = 'id, description, amount_cents, currency, spent_on, receipt_path';
      if (isLocal())
        return db.getAll<ExpenseOption>(
          `select ${cols} from expenses where created_by = ? and kind = 'out'
           order by spent_on desc, created_at desc limit 200`,
          [userId],
        );
      const { data, error } = await supabase
        .from('expenses')
        .select(cols)
        .eq('created_by', userId)
        .eq('kind', 'out')
        .order('spent_on', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ExpenseOption[];
    },
  });
}

export const newHomeId = () => uuidv7();
