import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Tables } from '../db';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, localInsert, localUpdate, newRowStamps } from '../sync/local';
import { uuidv7 } from '../uuid';
import { useSession } from '@/providers/session';
import { keys } from './keys';

export type Milestone = Tables<'milestones'>;

const order = (a: Milestone, b: Milestone) =>
  (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || a.position - b.position;

/** Marcos do projeto, por data (sem data por último). */
export function useMilestones(rootId: string | undefined) {
  return useQuery({
    queryKey: keys.milestones(rootId ?? ''),
    enabled: !!rootId,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<Milestone[]> => {
      if (isLocal()) {
        const rows = await db.getAll<Milestone>('select * from milestones where folder_id = ?', [
          rootId,
        ]);
        return rows.sort(order);
      }
      const { data, error } = await supabase
        .from('milestones')
        .select('*')
        .eq('folder_id', rootId ?? '');
      if (error) throw error;
      return data.sort(order);
    },
  });
}

export function useMilestoneMutations(rootId: string) {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const key = keys.milestones(rootId);
  const settle = () => queryClient.invalidateQueries({ queryKey: key });
  const patchCache = (fn: (list: Milestone[]) => Milestone[]) =>
    queryClient.setQueryData<Milestone[]>(key, (list) => (list ? fn(list).sort(order) : list));
  const networkMode = isLocal() ? ('always' as const) : ('online' as const);

  const create = useMutation({
    networkMode,
    mutationFn: async ({ name, dueDate }: { name: string; dueDate: string | null }) => {
      const id = uuidv7();
      const position = Date.now();
      if (isLocal()) {
        await localInsert('milestones', {
          id,
          folder_id: rootId,
          name,
          due_date: dueDate,
          done_at: null,
          position,
          created_by: session?.user.id ?? null,
          updated_by: session?.user.id ?? null,
          ...newRowStamps(),
        });
        return;
      }
      const { error } = await supabase
        .from('milestones')
        .insert({ id, folder_id: rootId, name, due_date: dueDate, position });
      if (error) throw error;
    },
    onSettled: settle,
  });

  const update = useMutation({
    networkMode,
    mutationFn: async ({
      id,
      ...patch
    }: { id: string } & Partial<Pick<Milestone, 'name' | 'due_date' | 'done_at'>>) => {
      if (isLocal()) {
        await localUpdate('milestones', id, patch);
        return;
      }
      const { error } = await supabase.from('milestones').update(patch).eq('id', id);
      if (error) throw error;
    },
    onMutate: ({ id, ...patch }) =>
      patchCache((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m))),
    onSettled: settle,
  });

  const remove = useMutation({
    networkMode,
    mutationFn: async (id: string) => {
      if (isLocal()) {
        await db.execute('delete from milestones where id = ?', [id]);
        return;
      }
      const { error } = await supabase.from('milestones').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) => patchCache((list) => list.filter((m) => m.id !== id)),
    onSettled: settle,
  });

  return { create, update, remove };
}
