import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { uuidv7 } from '@/lib/uuid';
import type { Tables } from '../db';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { plainText } from '../markdown-edit';
import { isLocal, localInsert, localUpdate, sessionUserId } from '../sync/local';

// Anotações (W3): texto em Markdown simples (D187), só da pessoa. Com o banco no aparelho, leem e gravam nele e o
// sync envia depois (funciona sem internet).

export type Note = Pick<Tables<'notes'>, 'id' | 'title' | 'body' | 'created_at' | 'updated_at'>;
export const NOTE_MAX = 20000;
const KEY = ['notes'] as const;

/** `fresh`: relê ao montar mesmo com o cache novo (o editor só abre depois de uma leitura nova) */
export function useNotes({ fresh = false }: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: KEY,
    ...(fresh ? { refetchOnMount: 'always' as const } : {}),
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<Note[]> => {
      if (isLocal()) {
        const rows = await db.getAll<Note>(
          'select id, title, body, created_at, updated_at from notes order by updated_at desc',
        );
        return rows;
      }
      const { data, error } = await supabase
        .from('notes')
        .select('id, title, body, created_at, updated_at')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Título para listas: o título, ou a primeira linha do texto */
export function noteTitle(note: Pick<Note, 'title' | 'body'>, fallback: string) {
  return note.title.trim() || plainText(note.body).trim().split('\n')[0].slice(0, 80) || fallback;
}

export function useNoteMutations() {
  const queryClient = useQueryClient();
  const networkMode = isLocal() ? ('always' as const) : ('online' as const);
  const settle = () => queryClient.invalidateQueries({ queryKey: KEY });
  const now = () => new Date().toISOString();

  const create = useMutation({
    networkMode,
    mutationFn: async (): Promise<string> => {
      const id = uuidv7();
      if (isLocal()) {
        await localInsert('notes', {
          id,
          user_id: await sessionUserId(),
          title: '',
          body: '',
          pinned: 0,
          created_at: now(),
          updated_at: now(),
        });
        return id;
      }
      const { error } = await supabase.from('notes').insert({ id, title: '', body: '' });
      if (error) throw error;
      return id;
    },
    onSettled: settle,
  });

  const update = useMutation({
    networkMode,
    mutationFn: async ({ id, ...patch }: { id: string; title?: string; body?: string }) => {
      if (isLocal()) {
        await localUpdate('notes', id, { ...patch, updated_at: now() });
        return;
      }
      const { error } = await supabase.from('notes').update(patch).eq('id', id);
      if (error) throw error;
    },
    onMutate: ({ id, ...patch }) => {
      queryClient.setQueryData<Note[]>(KEY, (list) =>
        list?.map((n) => (n.id === id ? { ...n, ...patch, updated_at: now() } : n)),
      );
    },
    onSettled: settle,
  });

  const remove = useMutation({
    networkMode,
    mutationFn: async (id: string) => {
      if (isLocal()) {
        await db.execute('delete from notes where id = ?', [id]);
        return;
      }
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) => {
      queryClient.setQueryData<Note[]>(KEY, (list) => list?.filter((n) => n.id !== id));
    },
    onSettled: settle,
  });

  return { create, update, remove };
}
