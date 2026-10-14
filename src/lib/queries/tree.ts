import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { uuidv7 } from '@/lib/uuid';

import type { Tables } from '../db';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import {
  isLocal,
  localInsert,
  localUpdate,
  newRowStamps,
  sessionUserId,
  toFolder,
  toPage,
} from '../sync/local';
import { keys } from './keys';

export type Folder = Tables<'folders'>;
export type Page = Tables<'pages'>;

export type PageSettings = {
  name: string;
  icon?: string | null;
  view_type?: Page['view_type'];
  reset_cycle?: Page['reset_cycle'];
  /** Limite de níveis de subtarefa da página; null = o do projeto (ou o padrão) */
  max_depth?: number | null;
};

export type SubFolder = Folder & { pages: Page[] };
export type FolderNode = SubFolder & { children: SubFolder[] };
/** inbox e habits: as páginas de sistema */
export type Tree = {
  inbox: Page | null;
  habits: Page | null;
  folders: FolderNode[];
  pages: Page[];
};

const byPosition = <T extends { position: number; created_at: string }>(a: T, b: T) =>
  a.position - b.position || a.created_at.localeCompare(b.created_at);

/** Pastas e páginas do usuário, já em árvore. A Caixa de entrada vem separada. */
export function useTree() {
  return useQuery({
    queryKey: keys.tree,
    queryFn: async (): Promise<Tree> => {
      const [folders, pages] = isLocal()
        ? await Promise.all([
            db
              .getAll<Record<string, unknown>>('select * from folders where archived = 0')
              .then((r) => ({
                data: r.map(toFolder),
              })),
            db
              .getAll<Record<string, unknown>>('select * from pages')
              .then((r) => ({ data: r.map(toPage) })),
          ])
        : await remoteTree();

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
        habits: pages.data.find((p) => p.is_habits) ?? null,
        folders: roots,
        pages: pages.data,
      };
    },
  });
}

async function remoteTree() {
  const [folders, pages] = await Promise.all([
    supabase.from('folders').select('*').eq('archived', false),
    supabase.from('pages').select('*'),
  ]);
  if (folders.error) throw folders.error;
  if (pages.error) throw pages.error;
  return [folders, pages] as const;
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
      kind = 'folder',
      color,
    }: {
      name: string;
      icon?: string | null;
      color?: string | null;
      parentId?: string;
      /** Projeto só na raiz */
      kind?: 'folder' | 'project';
    }) => {
      const siblings = parentId
        ? (tree()?.folders.find((f) => f.id === parentId)?.children ?? [])
        : (tree()?.folders ?? []);
      const id = uuidv7();
      const row = {
        id,
        name,
        icon: icon || null,
        parent_id: parentId ?? null,
        kind: parentId ? 'folder' : kind,
        color: color ?? null,
        position: nextPosition(siblings),
      };
      if (isLocal()) {
        const owner = await sessionUserId();
        await localInsert('folders', {
          ...row,
          ...newRowStamps(),
          owner_id: owner,
          is_shared: 0,
          is_inbox: 0,
          archived: 0,
        });
        // A participação nasce no servidor (trigger); aqui, para a pasta já aparecer como minha
        if (!parentId) {
          await localInsert('folder_members', {
            id: `${id}:${owner}`,
            folder_id: id,
            user_id: owner,
            role: 'owner',
            aliases: '[]',
            joined_at: new Date().toISOString(),
          });
        }
        return id;
      }
      const { error } = await supabase.from('folders').insert(row);
      if (error) throw error;
      return id;
    },
    onSettled,
  });

  const updateFolder = useMutation({
    mutationFn: async ({
      id,
      name,
      icon,
      color,
    }: {
      id: string;
      name: string;
      icon?: string | null;
      /** undefined = não mexe; null = sem cor */
      color?: string | null;
    }) => {
      const patch = { name, icon: icon || null, ...(color === undefined ? {} : { color }) };
      if (isLocal()) return localUpdate('folders', id, patch);
      const { error } = await supabase.from('folders').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSettled,
  });

  /** Configurações do projeto que não são nome/ícone (ex.: concluir a mãe sozinha). */
  const setFolderSettings = useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: {
      id: string;
      auto_complete_parent?: boolean;
      max_depth?: number | null;
    }) => {
      if (isLocal()) return localUpdate('folders', id, patch);
      const { error } = await supabase.from('folders').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSettled,
  });

  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      if (isLocal()) {
        // O servidor apaga em cascata; no aparelho, some tudo de uma vez para a tela não mostrar
        // tarefas de uma pasta que já não existe enquanto o sync não chega
        await db.writeTransaction(async (tx) => {
          const ids = `(select id from folders where id = ? or parent_id = ?)`;
          await tx.execute(`delete from tasks where folder_id in ${ids}`, [id, id]);
          await tx.execute(`delete from pages where folder_id in ${ids}`, [id, id]);
          await tx.execute('delete from folders where parent_id = ?', [id]);
          await tx.execute('delete from folders where id = ?', [id]);
        });
        return;
      }
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
      const id = uuidv7();
      const siblings = tree()?.pages.filter((p) => p.folder_id === folderId) ?? [];
      const row = {
        id,
        folder_id: folderId,
        ...settings,
        icon: settings.icon || null,
        position: nextPosition(siblings),
      };
      if (isLocal()) {
        await localInsert('pages', {
          view_type: 'list',
          reset_cycle: 'none',
          is_inbox: 0,
          is_habits: 0,
          manual_cycle: 0,
          ...newRowStamps(),
          ...row,
        });
        return id;
      }
      const { error } = await supabase.from('pages').insert(row);
      if (error) throw error;
      return id;
    },
    onSettled,
  });

  const updatePage = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & PageSettings) => {
      if (isLocal()) return localUpdate('pages', id, { ...patch, icon: patch.icon || null });
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

  /** Mover a página para outra pasta ou projeto (as tarefas vão junto: trigger no banco). */
  const movePage = useMutation({
    mutationFn: async ({ id, folderId }: { id: string; folderId: string }) => {
      const siblings = findFolder(tree(), folderId)?.folder.pages ?? [];
      if (isLocal()) {
        await db.writeTransaction(async (tx) => {
          await tx.execute('update pages set folder_id = ?, position = ? where id = ?', [
            folderId,
            nextPosition(siblings),
            id,
          ]);
          // No servidor é trigger; o folder_id das tarefas não sobe (não tem grant)
          await tx.execute('update tasks set folder_id = ? where page_id = ?', [folderId, id]);
        });
        return;
      }
      const { error } = await supabase
        .from('pages')
        .update({ folder_id: folderId, position: nextPosition(siblings) })
        .eq('id', id);
      if (error) throw error;
    },
    onSettled: () => {
      onSettled();
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
      if (isLocal()) {
        await db.writeTransaction(async (tx) => {
          await tx.execute('delete from tasks where page_id = ?', [id]);
          await tx.execute('delete from pages where id = ?', [id]);
        });
        return;
      }
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
    setFolderSettings,
    deleteFolder,
    createPage,
    updatePage,
    movePage,
    deletePage,
    duplicatePage,
    resetPage,
  };
}

/** Nome da página para texto (o ícone é desenhado à parte, pelo components/item-icon.tsx). */
export function pageLabel(page: Pick<Page, 'name'>) {
  return page.name;
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
