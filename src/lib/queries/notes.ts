import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { uuidv7 } from '@/lib/uuid';
import type { Tables } from '../db';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { plainText } from '../markdown-edit';
import { noteTags, type NoteProps } from '../note-props';
import { isLocal, localInsert, localUpdate, sessionUserId } from '../sync/local';

// Anotações (W3): texto em Markdown simples (D187). Sem pasta, só da pessoa; numa pasta ou projeto
// (pedido do dono, 20/10), de quem é dela. Com o banco no aparelho, leem e gravam nele e o sync
// envia depois (funciona sem internet).

export type Note = Pick<
  Tables<'notes'>,
  'id' | 'title' | 'body' | 'created_at' | 'updated_at' | 'folder_id' | 'tags'
> & {
  /** Propriedades (OB4, D289) */
  props: NoteProps;
};
const COLUMNS = 'id, title, body, created_at, updated_at, folder_id, props, tags';

type LocalNote = Omit<Note, 'props' | 'tags'> & { props: string | null; tags: string | null };
function parseJson<T>(value: string | null, fallback: T): T {
  try {
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}
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
        const rows = await db.getAll<LocalNote>(
          `select ${COLUMNS} from notes order by updated_at desc`,
        );
        return rows.map((n) => ({
          ...n,
          props: parseJson<NoteProps>(n.props, {}),
          tags: parseJson<string[]>(n.tags, []),
        }));
      }
      const { data, error } = await supabase
        .from('notes')
        .select(COLUMNS)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data.map((n) => ({ ...n, props: (n.props ?? {}) as NoteProps }));
    },
  });
}

/** Título para listas: o título, ou a primeira linha do texto */
export function noteTitle(note: Pick<Note, 'title' | 'body'>, fallback: string) {
  return note.title.trim() || plainText(note.body).trim().split('\n')[0].slice(0, 80) || fallback;
}

type NotePatch = { id: string; title?: string; body?: string; props?: NoteProps };

export function useNoteMutations() {
  const queryClient = useQueryClient();
  const networkMode = isLocal() ? ('always' as const) : ('online' as const);
  const settle = () => queryClient.invalidateQueries({ queryKey: KEY });
  const now = () => new Date().toISOString();

  const create = useMutation({
    networkMode,
    /**
     * `folderId`: anotação dentro de uma pasta ou projeto; sem ela, só da pessoa. Com `title`, já
     * nasce com o título (o link [[...]] para o que ainda não existia, OB1)
     */
    mutationFn: async (
      target?: string | null | { folderId?: string | null; title?: string },
    ): Promise<string> => {
      const id = uuidv7();
      const opts = typeof target === 'object' && target ? target : { folderId: target };
      const folder_id = opts.folderId ?? null;
      const title = (opts.title ?? '').slice(0, 200);
      if (isLocal()) {
        await localInsert('notes', {
          id,
          user_id: await sessionUserId(),
          title,
          body: '',
          pinned: 0,
          folder_id,
          props: '{}',
          tags: '[]',
          created_at: now(),
          updated_at: now(),
        });
        return id;
      }
      const { error } = await supabase.from('notes').insert({ id, title, body: '', folder_id });
      if (error) throw error;
      return id;
    },
    onSettled: settle,
  });

  const update = useMutation({
    networkMode,
    mutationFn: async ({ id, ...patch }: NotePatch) => {
      if (isLocal()) {
        const { props, ...rest } = patch;
        const row: Record<string, unknown> = { ...rest, updated_at: now() };
        if (props) row.props = JSON.stringify(props);
        // As etiquetas são do servidor; sem internet, o espelho calcula para a tela já mostrar
        if (props || patch.body !== undefined) {
          const current = await db.getOptional<{ body: string; props: string | null }>(
            'select body, props from notes where id = ?',
            [id],
          );
          row.tags = JSON.stringify(
            noteTags(
              patch.body ?? current?.body ?? '',
              props ?? parseJson<NoteProps>(current?.props ?? null, {}),
            ),
          );
        }
        await localUpdate('notes', id, row);
        return;
      }
      const { error } = await supabase.from('notes').update(patch).eq('id', id);
      if (error) throw error;
    },
    onMutate: ({ id, ...patch }) => {
      queryClient.setQueryData<Note[]>(KEY, (list) =>
        list?.map((n) => {
          if (n.id !== id) return n;
          const next = { ...n, ...patch, updated_at: now() };
          return { ...next, tags: noteTags(next.body, next.props) };
        }),
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
