import { useQuery } from '@tanstack/react-query';

import { buildGraph, type Graph, type GraphItem, type GraphLinkRow } from '../graph';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, myFolderIds, sessionUserId } from '../sync/local';
import { noteTitle, useNotes } from './notes';
import { useTree } from './tree';

// Grafo (OB9, D294): todos os links que a pessoa vê (do aparelho, sem internet, D86; ou do
// servidor pelas pastas dela e pelos links sem pasta, D70) e o título das tarefas citadas.

/** Teto de links lidos (o grafo fica ilegível bem antes) */
const LINK_LIMIT = 5000;

type GraphData = { links: GraphLinkRow[]; tasks: (GraphItem & { labels: string[] })[] };

const parseLabels = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string') return [];
  try {
    const list = JSON.parse(value);
    return Array.isArray(list) ? list.map(String) : [];
  } catch {
    return [];
  }
};

export function useGraph(): { graph: Graph | null; isPending: boolean; error: Error | null } {
  const notes = useNotes();
  const tree = useTree();
  const data = useQuery({
    queryKey: ['links', 'graph'],
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<GraphData> => {
      if (isLocal()) {
        const links = await db.getAll<GraphLinkRow>(
          `select source_kind, source_id, target_kind, target_id, target_title from links
            order by created_at limit ${LINK_LIMIT}`,
        );
        const ids = [
          ...new Set(
            links.flatMap((l) => [
              ...(l.source_kind === 'task' ? [l.source_id] : []),
              ...(l.target_kind === 'task' && l.target_id ? [l.target_id] : []),
            ]),
          ),
        ];
        const tasks = ids.length
          ? await db.getAll<{
              id: string;
              title: string;
              labels: string | null;
              folder_id: string;
            }>(
              `select id, title, labels, folder_id from tasks where id in (${ids.map(() => '?').join(',')})`,
              ids,
            )
          : [];
        return {
          links,
          tasks: tasks.map((t) => ({
            id: t.id,
            title: t.title,
            labels: parseLabels(t.labels),
            folderId: t.folder_id,
          })),
        };
      }
      const [folders, me] = await Promise.all([myFolderIds(), sessionUserId()]);
      const columns = 'source_kind, source_id, target_kind, target_id, target_title';
      const [mine, shared] = await Promise.all([
        supabase
          .from('links')
          .select(columns)
          .eq('user_id', me ?? '')
          .is('folder_id', null)
          .limit(LINK_LIMIT),
        folders.length
          ? supabase.from('links').select(columns).in('folder_id', folders).limit(LINK_LIMIT)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (mine.error) throw mine.error;
      if (shared.error) throw shared.error;
      const links = [...(mine.data ?? []), ...(shared.data ?? [])] as GraphLinkRow[];
      const ids = [
        ...new Set(
          links.flatMap((l) => [
            ...(l.source_kind === 'task' ? [l.source_id] : []),
            ...(l.target_kind === 'task' && l.target_id ? [l.target_id] : []),
          ]),
        ),
      ];
      const tasks: GraphData['tasks'] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await supabase
          .from('tasks')
          .select('id, title, labels, folder_id')
          .in('id', ids.slice(i, i + 200));
        if (error) throw error;
        for (const t of data)
          tasks.push({ id: t.id, title: t.title, labels: t.labels ?? [], folderId: t.folder_id });
      }
      return { links, tasks };
    },
  });
  if (!notes.data || !tree.data || !data.data)
    return { graph: null, isPending: data.isPending, error: data.error };
  const folders = tree.data.folders.flatMap((f) => [
    { id: f.id, title: f.name, folderId: f.id },
    ...f.children.map((c) => ({ id: c.id, title: c.name, folderId: c.id })),
  ]);
  const graph = buildGraph({
    links: data.data.links,
    notes: notes.data.map((n) => ({
      id: n.id,
      title: noteTitle(n, ''),
      tags: n.tags ?? [],
      folderId: n.folder_id,
    })),
    tasks: new Map(data.data.tasks.map((t) => [t.id, { ...t, tags: t.labels }])),
    pages: tree.data.pages.map((p) => ({ id: p.id, title: p.name, folderId: p.folder_id })),
    folders,
  });
  return { graph, isPending: false, error: null };
}
