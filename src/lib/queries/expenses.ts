import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Json, Tables } from '../db';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, localInsert, localUpdate, sessionUserId } from '../sync/local';
import { uuidv7 } from '../uuid';
import { keys } from './keys';

// Gastos (ESCOPO_V9): os lançamentos de uma página de gastos. Com o banco no aparelho, leem e
// gravam nele e o sync envia depois (funciona sem internet), como as anotações.

export type Expense = Omit<Tables<'expenses'>, 'items' | 'split_among'> & {
  items: { description: string; amount_cents: number }[] | null;
  /** Racha (PB5): quem divide este gasto; nulo = ninguém */
  split_among: string[] | null;
};
export type ExpenseInput = Partial<
  Pick<
    Expense,
    | 'spent_on'
    | 'description'
    | 'category'
    | 'amount_cents'
    | 'currency'
    | 'kind'
    | 'paid_by'
    | 'method'
    | 'task_id'
    | 'receipt_path'
    | 'nfce_key'
    | 'items'
    | 'note'
    | 'split_among'
  >
>;

export type NewExpense = ExpenseInput & { id: string; description: string; amount_cents: number };

export const expensesKey = (pageId: string) => ['expenses', pageId] as const;

const COLUMNS =
  'id, page_id, folder_id, spent_on, description, category, amount_cents, currency, kind, paid_by, method, task_id, receipt_path, nfce_key, items, note, split_among, created_by, created_at, updated_at';

/** No SQLite, `items` e `split_among` são texto */
const fromLocal = (row: Record<string, unknown>) =>
  ({
    ...row,
    items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items ?? null),
    split_among:
      typeof row.split_among === 'string' ? JSON.parse(row.split_among) : (row.split_among ?? null),
  }) as Expense;

export function useExpenses(pageId: string | undefined) {
  return useQuery({
    queryKey: expensesKey(pageId ?? ''),
    enabled: !!pageId,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<Expense[]> => {
      if (!pageId) return [];
      if (isLocal()) {
        const rows = await db.getAll<Record<string, unknown>>(
          `select ${COLUMNS} from expenses where page_id = ? order by spent_on desc, created_at desc`,
          [pageId],
        );
        return rows.map(fromLocal);
      }
      const { data, error } = await supabase
        .from('expenses')
        .select(COLUMNS)
        .eq('page_id', pageId)
        .order('spent_on', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as Expense[];
    },
  });
}

/** Um lançamento (painel de edição): sai da lista da página, que já está em cache. */
export function useExpense(pageId: string | undefined, id: string | undefined) {
  const list = useExpenses(pageId);
  return { ...list, data: list.data?.find((e) => e.id === id) };
}

export function useExpenseMutations(pageId: string) {
  const queryClient = useQueryClient();
  const networkMode = isLocal() ? ('always' as const) : ('online' as const);
  const key = expensesKey(pageId);
  const settle = () => queryClient.invalidateQueries({ queryKey: key });
  const now = () => new Date().toISOString();
  const patchList = (fn: (list: Expense[]) => Expense[]) =>
    queryClient.setQueryData<Expense[]>(key, (list) => fn(list ?? []));

  const create = useMutation({
    networkMode,
    mutationFn: async (input: NewExpense) => {
      const row = { page_id: pageId, ...input };
      if (isLocal()) {
        const folder = await db.getOptional<{ folder_id: string }>(
          'select folder_id from pages where id = ?',
          [pageId],
        );
        await localInsert('expenses', {
          kind: 'out',
          currency: 'BRL',
          ...row,
          folder_id: folder?.folder_id ?? null,
          created_by: await sessionUserId(),
          created_at: now(),
          updated_at: now(),
        });
        return input.id;
      }
      const { error } = await supabase
        .from('expenses')
        .insert({ ...row, items: row.items as Json, split_among: row.split_among as Json });
      if (error) throw error;
      return input.id;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const optimistic = {
        id: input.id,
        page_id: pageId,
        folder_id: null,
        spent_on: input.spent_on ?? now().slice(0, 10),
        description: input.description ?? '',
        category: input.category ?? null,
        amount_cents: input.amount_cents ?? 0,
        currency: input.currency ?? 'BRL',
        kind: input.kind ?? 'out',
        paid_by: input.paid_by ?? null,
        method: input.method ?? null,
        task_id: input.task_id ?? null,
        receipt_path: input.receipt_path ?? null,
        nfce_key: input.nfce_key ?? null,
        items: input.items ?? null,
        note: input.note ?? null,
        split_among: input.split_among ?? null,
        created_by: null,
        created_at: now(),
        updated_at: now(),
      } satisfies Expense;
      patchList((list) => [optimistic, ...list]);
    },
    onError: (_err, input) => patchList((list) => list.filter((e) => e.id !== input.id)),
    onSettled: settle,
  });

  const update = useMutation({
    networkMode,
    mutationFn: async ({ id, ...patch }: ExpenseInput & { id: string }) => {
      if (isLocal()) {
        await localUpdate('expenses', id, { ...patch, updated_at: now() });
        return;
      }
      const { error } = await supabase
        .from('expenses')
        .update({ ...patch, items: patch.items as Json, split_among: patch.split_among as Json })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: ({ id, ...patch }) => {
      const before = queryClient.getQueryData<Expense[]>(key);
      patchList((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)));
      return { before };
    },
    onError: (_err, _vars, context) => queryClient.setQueryData(key, context?.before),
    onSettled: settle,
  });

  const remove = useMutation({
    networkMode,
    mutationFn: async (id: string) => {
      if (isLocal()) {
        await db.execute('delete from expenses where id = ?', [id]);
        return;
      }
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) => {
      const before = queryClient.getQueryData<Expense[]>(key);
      patchList((list) => list.filter((e) => e.id !== id));
      return { before };
    },
    onError: (_err, _id, context) => queryClient.setQueryData(key, context?.before),
    onSettled: settle,
  });

  /** Orçamento da página (null tira). */
  const setBudget = useMutation({
    networkMode,
    mutationFn: async (cents: number | null) => {
      if (isLocal()) return localUpdate('pages', pageId, { budget_cents: cents });
      const { error } = await supabase
        .from('pages')
        .update({ budget_cents: cents })
        .eq('id', pageId);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.tree }),
  });

  return { create, update, remove, setBudget };
}

export const newExpenseId = () => uuidv7();
