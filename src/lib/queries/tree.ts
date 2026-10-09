import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';

import type { Tables } from '../db';
import { supabase } from '../supabase';
import { keys } from './keys';

export type Folder = Tables<'folders'>;
export type Page = Tables<'pages'>;

export type PageSettings = {
  name: string;
  icon?: string;
  view_type?: Page['view_type'];
  reset_cycle?: Page['reset_cycle'];
};

export type SubFolder = Folder & { pages: Page[] };
export type FolderNode = SubFolder & { children: SubFolder[] };
export type Tree = { inbox: Page | null; folders: FolderNode[]; pages: Page[] };

const byPosition = <T extends { position: number; created_at: string }>(a: T, b: T) =>
  a.position - b.position || a.created_at.localeCompare(b.created_at);

/** Pastas e páginas do usuário, já em árvore. A Caixa de entrada vem separada. */
export function useTree() {
  return useQuery({
    queryKey: keys.tree,
    queryFn: async (): Promise<Tree> => {
      const [folders, pages] = await Promise.all([
        supabase.from('folders').select('*').eq('archived', false),
        supabase.from('pages').select('*'),
      ]);
      if (folders.error) throw folders.error;
      if (pages.error) throw pages.error;

      const pagesOf = (folderId: string) =>
        pages.data.filter((p) => p.folder_id === folderId).sort(byPosition);
      const visible = folders.data.filter((f) => !f.is_inbox);
      const roots: FolderNode[] = visible
        .filter((f) => !f.parent_id)
        .sort(byPosition)
        .map((f) => ({
          ...f,
          pages: pagesOf(f.id),
          children: visible
            .filter((c) => c.parent_id === f.id)
            .sort(byPosition)
            .map((c) => ({ ...c, pages: pagesOf(c.id) })),
        }));

      return {
        inbox: pages.data.find((p) => p.is_inbox) ?? null,
        folders: roots,
        pages: pages.data,
      };
    },
  });
}

function nextPosition(items: { position: number }[]) {
  return items.reduce((max, i) => Math.max(max, i.position), 0) + 1;
}

export function useTreeMutations() {
  const queryClient = useQueryClient();
  const tree = () => queryClient.getQueryData<Tree>(keys.tree);
  const onSettled = () => queryClient.invalidateQueries({ queryKey: keys.tree });

  const createFolder = useMutation({
    mutationFn: async ({
      name,
      icon,
      parentId,
    }: {
      name: string;
      icon?: string;
      parentId?: string;
    }) => {
      const siblings = parentId
        ? (tree()?.folders.find((f) => f.id === parentId)?.children ?? [])
        : (tree()?.folders ?? []);
      const id = randomUUID();
      const { error } = await supabase.from('folders').insert({
        id,
        name,
        icon: icon || null,
        parent_id: parentId ?? null,
        position: nextPosition(siblings),
      });
      if (error) throw error;
      return id;
    },
    onSettled,
  });

  const updateFolder = useMutation({
    mutationFn: async ({ id, name, icon }: { id: string; name: string; icon?: string }) => {
      const { error } = await supabase
        .from('folders')
        .update({ name, icon: icon || null })
        .eq('id', id);
      if (error) throw error;
    },
    onSettled,
  });

  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('folders').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: () => {
      onSettled();
      queryClient.invalidateQueries({ queryKey: keys.tasks });
    },
  });

  const createPage = useMutation({
    mutationFn: async ({ folderId, ...settings }: { folderId: string } & PageSettings) => {
      const id = randomUUID();
      const siblings = tree()?.pages.filter((p) => p.folder_id === folderId) ?? [];
      const { error } = await supabase.from('pages').insert({
        id,
        folder_id: folderId,
        ...settings,
        icon: settings.icon || null,
        position: nextPosition(siblings),
      });
      if (error) throw error;
      return id;
    },
    onSettled,
  });

  const updatePage = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & PageSettings) => {
      const { error } = await supabase
        .from('pages')
        .update({ ...patch, icon: patch.icon || null })
        .eq('id', id);
      if (error) throw error;
    },
    onSettled: () => {
      onSettled();
      // Trocar tipo/ciclo muda o que conta como feito
      queryClient.invalidateQueries({ queryKey: keys.tasks });
    },
  });

  const duplicatePage = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await supabase.rpc('duplicate_page', { p_page_id: id, p_name: name });
      if (error) throw error;
      return data;
    },
    onSettled,
  });

  const resetPage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('reset_page', { p_page_id: id });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.tasks }),
  });

  const deletePage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pages').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: () => {
      onSettled();
      queryClient.invalidateQueries({ queryKey: keys.tasks });
    },
  });

  return {
    createFolder,
    updateFolder,
    deleteFolder,
    createPage,
    updatePage,
    deletePage,
    duplicatePage,
    resetPage,
  };
}

const DEFAULT_PAGE_ICON: Record<string, string> = {
  list: '📄',
  cards: '🃏',
  habits: '🔥',
  kanban: '📋',
};

/** Nome para exibir de uma página: "📄 Nome" (sem ícone próprio, usa o do tipo). */
export function pageLabel(page: Pick<Page, 'icon' | 'name'> & { view_type?: string }) {
  return `${page.icon || DEFAULT_PAGE_ICON[page.view_type ?? 'list'] || '📄'} ${page.name}`;
}

/** Pasta pelo id (raiz ou subpasta), com a pasta-mãe quando for subpasta. */
export function findFolder(
  tree: Tree | undefined,
  id: string,
): { folder: FolderNode | SubFolder; parent: FolderNode | null } | null {
  for (const root of tree?.folders ?? []) {
    if (root.id === id) return { folder: root, parent: null };
    const child = root.children.find((c) => c.id === id);
    if (child) return { folder: child, parent: root };
  }
  return null;
}
