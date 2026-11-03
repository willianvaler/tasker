import { useQuery } from '@tanstack/react-query';

import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal } from '../sync/local';
import type { LinkKind } from '../wikilinks';
import { noteAliases } from '../note-props';
import { noteTitle, useNotes } from './notes';
import { useTree } from './tree';

// Links [[...]] (OB1, OB2, D286): o "Citado em" sai da tabela `links` (refeita pelo servidor a cada
// gravação e no aparelho pelo sync), o autocomplete do "[[" junta as anotações às tarefas, listas e
// pastas que a pessoa vê, e os títulos dos links são lidos de novo (renomear não quebra).

export type Backlink = {
  sourceKind: 'note' | 'task';
  sourceId: string;
  /** Vazio: anotação sem título (o app mostra a primeira linha) */
  title: string;
  context: string;
};
export type LinkCandidate = { kind: LinkKind; id: string; title: string; context: string | null };

type LinkRow = { source_kind: 'note' | 'task'; source_id: string; context: string };

/** Quem aponta para `id` (uma linha por origem, com a frase do primeiro link) */
export function useBacklinks(kind: LinkKind, id: string | undefined) {
  const notes = useNotes();
  const query = useQuery({
    queryKey: ['links', 'to', kind, id ?? ''],
    enabled: !!id,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<(LinkRow & { task_title: string | null })[]> => {
      if (isLocal()) {
        return db.getAll(
          `select l.source_kind, l.source_id, l.context, t.title as task_title
             from links l left join tasks t on l.source_kind = 'task' and t.id = l.source_id
            where l.target_id = ? and l.target_kind = ? and l.source_id <> ?
            order by l.created_at desc, l.position`,
          [id ?? '', kind, id ?? ''],
        );
      }
      const { data, error } = await supabase
        .from('links')
        .select('source_kind, source_id, context')
        .eq('target_id', id ?? '')
        .eq('target_kind', kind)
        .neq('source_id', id ?? '')
        .order('created_at', { ascending: false })
        .order('position');
      if (error) throw error;
      const rows = data as LinkRow[];
      const taskIds = [
        ...new Set(rows.filter((r) => r.source_kind === 'task').map((r) => r.source_id)),
      ];
      const titles = new Map<string, string>();
      if (taskIds.length) {
        const tasks = await supabase.from('tasks').select('id, title').in('id', taskIds);
        if (tasks.error) throw tasks.error;
        for (const t of tasks.data) titles.set(t.id, t.title);
      }
      return rows.map((r) => ({ ...r, task_title: titles.get(r.source_id) ?? null }));
    },
  });
  const byId = new Map((notes.data ?? []).map((n) => [n.id, n]));
  const seen = new Set<string>();
  const list: Backlink[] = [];
  for (const row of query.data ?? []) {
    if (seen.has(row.source_id)) continue;
    seen.add(row.source_id);
    const note = row.source_kind === 'note' ? byId.get(row.source_id) : undefined;
    // A origem que a pessoa não lê mais (ou ainda não chegou ao aparelho) fica de fora
    if (row.source_kind === 'note' && !note) continue;
    if (row.source_kind === 'task' && row.task_title == null) continue;
    list.push({
      sourceKind: row.source_kind,
      sourceId: row.source_id,
      title: note ? noteTitle(note, '') : (row.task_title ?? ''),
      context: row.context,
    });
  }
  return { ...query, list };
}

/**
 * O título de agora de cada destino de link. `null`: a pessoa não vê (ou foi apagado); `undefined`:
 * ainda lendo. Anotações, listas e pastas já estão no aparelho; as tarefas são lidas pelo id.
 */
export function useLinkTitles(refs: readonly { kind: LinkKind; id: string }[]) {
  const notes = useNotes();
  const tree = useTree();
  const taskIds = [...new Set(refs.filter((r) => r.kind === 'task').map((r) => r.id))].sort();
  const tasks = useQuery({
    queryKey: ['links', 'task-titles', taskIds.join(',')],
    enabled: taskIds.length > 0,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<Record<string, string>> => {
      if (isLocal()) {
        const rows = await db.getAll<{ id: string; title: string }>(
          `select id, title from tasks where id in (${taskIds.map(() => '?').join(',')})`,
          taskIds,
        );
        return Object.fromEntries(rows.map((r) => [r.id, r.title]));
      }
      const { data, error } = await supabase.from('tasks').select('id, title').in('id', taskIds);
      if (error) throw error;
      return Object.fromEntries(data.map((r) => [r.id, r.title]));
    },
  });
  return (kind: LinkKind, id: string): string | null | undefined => {
    if (kind === 'note') {
      if (!notes.data) return undefined;
      const note = notes.data.find((n) => n.id === id);
      return note ? noteTitle(note, '') : null;
    }
    if (kind === 'task') {
      if (!tasks.data) return undefined;
      return tasks.data[id] ?? null;
    }
    if (!tree.data) return undefined;
    if (kind === 'page') return tree.data.pages.find((p) => p.id === id)?.name ?? null;
    for (const root of tree.data.folders) {
      if (root.id === id) return root.name;
      const child = root.children.find((c) => c.id === id);
      if (child) return child.name;
    }
    return null;
  };
}

const NOTE_LIMIT = 6;

/**
 * Sugestões do "[[": as anotações primeiro (as mais recentes), depois tarefas, listas e projetos
 * que a pessoa vê. Sem nada digitado, só as anotações recentes.
 */
export function useLinkCandidates(text: string | null, exclude?: string) {
  const notes = useNotes();
  const term = (text ?? '').trim();
  const others = useQuery({
    queryKey: ['links', 'candidates', term],
    enabled: text != null && term.length >= 2,
    networkMode: isLocal() ? 'always' : 'online',
    staleTime: 30_000,
    queryFn: async (): Promise<LinkCandidate[]> => {
      if (isLocal()) {
        const like = `%${term.replace(/[%_]/g, '')}%`;
        const [folders, pages, tasks] = await Promise.all([
          db.getAll<{ id: string; name: string }>(
            `select id, name from folders where parent_id is null and is_inbox = 0 and archived = 0
              and name like ? order by name limit 5`,
            [like],
          ),
          db.getAll<{ id: string; name: string; folder: string | null }>(
            `select p.id, p.name, f.name as folder from pages p left join folders f on f.id = p.folder_id
              where p.name like ? order by p.name limit 8`,
            [like],
          ),
          db.getAll<{ id: string; title: string; page: string | null }>(
            `select t.id, t.title, p.name as page from tasks t left join pages p on p.id = t.page_id
              where t.title like ? order by t.status = 'done', t.title limit 12`,
            [like],
          ),
        ]);
        return [
          ...tasks.map((t) => ({
            kind: 'task' as const,
            id: t.id,
            title: t.title,
            context: t.page,
          })),
          ...pages.map((p) => ({
            kind: 'page' as const,
            id: p.id,
            title: p.name,
            context: p.folder,
          })),
          ...folders.map((f) => ({
            kind: 'folder' as const,
            id: f.id,
            title: f.name,
            context: null,
          })),
        ];
      }
      const { data, error } = await supabase.rpc('relation_candidates', { p_query: term });
      if (error) throw error;
      const order = { task: 0, page: 1, folder: 2 } as const;
      return (
        data as {
          type: 'task' | 'page' | 'folder';
          id: string;
          title: string;
          context: string | null;
        }[]
      )
        .map((c) => ({ kind: c.type, id: c.id, title: c.title, context: c.context }))
        .sort((a, b) => order[a.kind] - order[b.kind]);
    },
  });
  if (text == null) return [];
  const key = term.toLocaleLowerCase();
  // O título ou um dos apelidos (OB4); achada pelo apelido, ele aparece ao lado
  const noteHits: LinkCandidate[] = (notes.data ?? [])
    .filter((n) => n.id !== exclude)
    .flatMap((n): LinkCandidate[] => {
      const title = noteTitle(n, '');
      if (!title) return [];
      if (!key || title.toLocaleLowerCase().includes(key))
        return [{ kind: 'note' as const, id: n.id, title, context: null }];
      const alias = noteAliases(n.props).find((a) => a.toLocaleLowerCase().includes(key));
      return alias ? [{ kind: 'note' as const, id: n.id, title, context: alias }] : [];
    })
    .slice(0, NOTE_LIMIT);
  return [...noteHits, ...(term.length >= 2 ? (others.data ?? []) : [])].slice(0, 14);
}
