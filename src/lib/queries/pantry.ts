import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PantryItem } from '../pantry';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, localInsert, localUpdate, sessionUserId } from '../sync/local';

/**
 * Despensa (CS4, D390): os itens de uma lista do tipo despensa. Lê e grava no aparelho depois da
 * primeira sincronização; a compra (tarefa na lista de compras) e a soma ao estoque são do
 * servidor e voltam pelo sync.
 */
export const pantryKey = (pageId: string) => ['pantry', pageId] as const;
const COLS = 'id, page_id, name, unit, qty, min_qty, buy_qty, position, shopping_task_id';

export type PantryInput = Pick<PantryItem, 'name' | 'unit' | 'qty' | 'min_qty' | 'buy_qty'>;

export function usePantry(pageId: string | undefined) {
  return useQuery({
    queryKey: pantryKey(pageId ?? ''),
    enabled: !!pageId,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<PantryItem[]> => {
      if (!pageId) return [];
      if (isLocal()) {
        return db.getAll<PantryItem>(
          `select ${COLS} from pantry_items where page_id = ? order by position, name`,
          [pageId],
        );
      }
      const { data, error } = await supabase
        .from('pantry_items')
        .select(COLS)
        .eq('page_id', pageId)
        .order('position')
        .order('name');
      if (error) throw error;
      return (data ?? []).map((x) => ({
        ...x,
        qty: Number(x.qty),
        min_qty: Number(x.min_qty),
        buy_qty: Number(x.buy_qty),
      }));
    },
  });
}

export function usePantryMutations(pageId: string) {
  const queryClient = useQueryClient();
  const key = pantryKey(pageId);
  const networkMode = isLocal() ? ('always' as const) : ('online' as const);
  const patch = (fn: (list: PantryItem[]) => PantryItem[]) =>
    queryClient.setQueryData<PantryItem[]>(key, (list) => fn(list ?? []));
  const settle = () => queryClient.invalidateQueries({ queryKey: key });

  const create = useMutation({
    networkMode,
    mutationFn: async (item: PantryInput & { id: string; position: number }) => {
      if (isLocal()) {
        const folder = await db.getOptional<{ folder_id: string }>(
          'select folder_id from pages where id = ?',
          [pageId],
        );
        const now = new Date().toISOString();
        await localInsert('pantry_items', {
          ...item,
          page_id: pageId,
          folder_id: folder?.folder_id ?? null,
          created_by: await sessionUserId(),
          created_at: now,
          updated_at: now,
        });
        return;
      }
      const { error } = await supabase.from('pantry_items').insert({ ...item, page_id: pageId });
      if (error) throw error;
    },
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: key });
      patch((list) => [...list, { ...item, page_id: pageId, shopping_task_id: null }]);
    },
    onSettled: settle,
  });

  const update = useMutation({
    networkMode,
    mutationFn: async ({ id, ...values }: Partial<PantryInput> & { id: string }) => {
      if (isLocal()) {
        await localUpdate('pantry_items', id, { ...values, updated_at: new Date().toISOString() });
        return;
      }
      const { error } = await supabase.from('pantry_items').update(values).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, ...values }) => {
      await queryClient.cancelQueries({ queryKey: key });
      patch((list) => list.map((x) => (x.id === id ? { ...x, ...values } : x)));
    },
    onSettled: settle,
  });

  const remove = useMutation({
    networkMode,
    mutationFn: async (id: string) => {
      if (isLocal()) {
        await db.execute('delete from pantry_items where id = ?', [id]);
        return;
      }
      const { error } = await supabase.from('pantry_items').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) => patch((list) => list.filter((x) => x.id !== id)),
    onSettled: settle,
  });

  return { create, update, remove };
}

/** A lista de compras da despensa (`pages.config.pantry.shopping`). */
export function pantryShopping(config: unknown): string | null {
  const c = config as { pantry?: { shopping?: unknown } } | null;
  return typeof c?.pantry?.shopping === 'string' ? c.pantry.shopping : null;
}
