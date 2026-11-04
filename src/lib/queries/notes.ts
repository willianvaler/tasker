import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { uuidv7 } from '@/lib/uuid';
import type { Tables } from '../db';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { plainText } from '../markdown-edit';
import { noteTags, type NoteProps } from '../note-props';
import { addDays } from '../parser/dates';
import { zonedEpoch } from '../reminder-time';
import {
  isLocal,
  localInsert,
  localUpdate,
  myFolderIds,
  sessionUserId,
  TASK_WITH_PAGE_SQL,
  toTaskWithPage,
} from '../sync/local';
import type { TaskWithPage } from './tasks';

// Anotações (W3): texto em Markdown simples (D187). Sem pasta, só da pessoa; numa pasta ou projeto
// (pedido do dono, 20/10), de quem é dela. Com o banco no aparelho, leem e gravam nele e o sync
// envia depois (funciona sem internet).

export type Note = Pick<
  Tables<'notes'>,
  | 'id'
  | 'user_id'
  | 'title'
  | 'body'
  | 'created_at'
  | 'updated_at'
  | 'folder_id'
  | 'tags'
  | 'is_template'
> & {
  /** Propriedades (OB4, D289) */
  props: NoteProps;
};
const COLUMNS =
  'id, user_id, title, body, created_at, updated_at, folder_id, props, tags, is_template';

type LocalNote = Omit<Note, 'props' | 'tags' | 'is_template'> & {
  props: string | null;
  tags: string | null;
  is_template: number | null;
};
function parseJson<T>(value: string | null, fallback: T): T {
  try {
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}
export const NOTE_MAX = 20000;
const KEY = ['notes'] as const;

/**
 * `fresh`: relê ao montar mesmo com o cache novo (o editor só abre depois de uma leitura nova).
 * `templates`: os modelos (OB5) ficam fora das listas; o editor pede todas, a lista de modelos só eles
 */
export function useNotes({
  fresh = false,
  templates = 'exclude',
}: { fresh?: boolean; templates?: 'exclude' | 'include' | 'only' } = {}) {
  return useQuery({
    queryKey: KEY,
    ...(fresh ? { refetchOnMount: 'always' as const } : {}),
    select: (list: Note[]) =>
      templates === 'include'
        ? list
        : list.filter((n) => !!n.is_template === (templates === 'only')),
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
          is_template: !!n.is_template,
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

/**
 * Anotação pessoal de outra pessoa, compartilhada comigo (OB14). As de pasta seguem a pasta; sem
 * saber quem sou (antes da sessão), vale como minha
 */
export function isSharedWithMe(
  note: Pick<Note, 'user_id' | 'folder_id'>,
  me: string | null | undefined,
) {
  return !note.folder_id && !!me && note.user_id !== me;
}

/** Título para listas: o título, ou a primeira linha do texto */
export function noteTitle(note: Pick<Note, 'title' | 'body'>, fallback: string) {
  return note.title.trim() || plainText(note.body).trim().split('\n')[0].slice(0, 80) || fallback;
}

type NotePatch = {
  id: string;
  title?: string;
  body?: string;
  props?: NoteProps;
  is_template?: boolean;
};

/** Anotação nova: na pasta, com título e texto (o link para o que não existia, o modelo, OB1/OB5) */
export type NewNote = {
  folderId?: string | null;
  title?: string;
  body?: string;
  props?: NoteProps;
  isTemplate?: boolean;
};

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
    mutationFn: async (target?: string | null | NewNote): Promise<string> => {
      const id = uuidv7();
      const opts: NewNote = typeof target === 'object' && target ? target : { folderId: target };
      const folder_id = opts.folderId ?? null;
      const title = (opts.title ?? '').slice(0, 200);
      const body = (opts.body ?? '').slice(0, NOTE_MAX);
      const props = opts.props ?? {};
      const is_template = !!opts.isTemplate;
      if (isLocal()) {
        await localInsert('notes', {
          id,
          user_id: await sessionUserId(),
          title,
          body,
          pinned: 0,
          folder_id,
          props: JSON.stringify(props),
          tags: JSON.stringify(noteTags(body, props)),
          is_template: is_template ? 1 : 0,
          created_at: now(),
          updated_at: now(),
        });
        return id;
      }
      const { error } = await supabase
        .from('notes')
        .insert({ id, title, body, folder_id, props, is_template });
      if (error) throw error;
      return id;
    },
    onSettled: settle,
  });

  const update = useMutation({
    networkMode,
    mutationFn: async ({ id, ...patch }: NotePatch) => {
      if (isLocal()) {
        const { props, is_template, ...rest } = patch;
        const row: Record<string, unknown> = { ...rest, updated_at: now() };
        if (props) row.props = JSON.stringify(props);
        if (is_template !== undefined) row.is_template = is_template ? 1 : 0;
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

  /**
   * Várias anotações de uma vez (importar o cofre do Obsidian, OB13), com os ids já gerados (os
   * links entre elas já apontam para eles). Pessoais, sem pasta
   */
  const createMany = useMutation({
    networkMode,
    mutationFn: async (list: { id: string; title: string; body: string; props: NoteProps }[]) => {
      if (!list.length) return;
      if (isLocal()) {
        const user_id = await sessionUserId();
        const at = now();
        await db.writeTransaction(async (tx) => {
          for (const n of list)
            await tx.execute(
              `insert into notes (id, user_id, title, body, pinned, folder_id, props, tags, is_template,
                 created_at, updated_at) values (?, ?, ?, ?, 0, null, ?, ?, 0, ?, ?)`,
              [
                n.id,
                user_id,
                n.title.slice(0, 200),
                n.body.slice(0, NOTE_MAX),
                JSON.stringify(n.props),
                JSON.stringify(noteTags(n.body, n.props)),
                at,
                at,
              ],
            );
        });
        return;
      }
      for (let i = 0; i < list.length; i += 100) {
        const { error } = await supabase.from('notes').insert(
          list.slice(i, i + 100).map((n) => ({
            id: n.id,
            title: n.title.slice(0, 200),
            body: n.body.slice(0, NOTE_MAX),
            props: n.props,
          })),
        );
        if (error) throw error;
      }
    },
    onSettled: settle,
  });

  return { create, update, remove, createMany };
}

/**
 * Diário automático da nota do dia (OB5): as tarefas concluídas e as criadas no dia `date` (no fuso
 * do perfil), só das minhas pastas (as recebidas ficam de fora). O filtro seletivo é o intervalo de
 * datas mais as pastas (D70).
 */
export function useDayTasks(date: string | null, timeZone: string) {
  return useQuery({
    queryKey: ['tasks', 'day-journal', date, timeZone],
    enabled: !!date,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<{ done: TaskWithPage[]; created: TaskWithPage[] }> => {
      if (!date) return { done: [], created: [] };
      const from = new Date(zonedEpoch(date, '00:00', timeZone)).toISOString();
      const to = new Date(zonedEpoch(addDays(date, 1), '00:00', timeZone)).toISOString();
      let rows: TaskWithPage[];
      if (isLocal()) {
        // O texto da data no aparelho pode vir com espaço ou "T": compara pelo dia, com folga, e
        // acerta o fuso abaixo
        const lo = addDays(date, -1);
        const hi = addDays(date, 1);
        const found = await db.getAll<Record<string, unknown>>(
          `${TASK_WITH_PAGE_SQL}
           where substr(t.completed_at, 1, 10) between ? and ? or substr(t.created_at, 1, 10) between ? and ?
           order by t.completed_at, t.created_at limit 400`,
          [lo, hi, lo, hi],
        );
        rows = found.map(toTaskWithPage);
      } else {
        const folders = await myFolderIds();
        if (!folders.length) return { done: [], created: [] };
        const { data, error } = await supabase
          .from('tasks')
          .select('*, page:pages(name, icon, view_type)')
          .in('folder_id', folders)
          .or(
            `and(completed_at.gte.${from},completed_at.lt.${to}),and(created_at.gte.${from},created_at.lt.${to})`,
          )
          .limit(400);
        if (error) throw error;
        rows = data as TaskWithPage[];
      }
      const inDay = (at: string | null) => !!at && at >= from && at < to;
      const norm = (at: string | null) => (at ? new Date(at).toISOString() : null);
      const done = rows.filter((t) => t.status === 'done' && inDay(norm(t.completed_at)));
      const created = rows.filter(
        (t) => inDay(norm(t.created_at)) && !done.some((d) => d.id === t.id),
      );
      return { done, created };
    },
  });
}
