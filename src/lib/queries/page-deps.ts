import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  blockedPages,
  pageBlockers,
  pageProgress,
  type PageDep,
  type PageProgress,
} from '../page-deps';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, localInsert } from '../sync/local';
import { uuidv7 } from '../uuid';
import { keys } from './keys';
import { invalidateWhenIdle } from './tasks';
import { useProjectAllTasks } from './flow';
import type { FolderNode } from './tree';

const depsKey = (rootId: string) => ['page-dependencies', rootId] as const;

/** Ligações entre as listas do projeto. Lê do aparelho quando o sync está ligado. */
function useRawPageDeps(rootId: string | undefined) {
  return useQuery({
    queryKey: depsKey(rootId ?? ''),
    enabled: !!rootId,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<PageDep[]> => {
      if (isLocal())
        return db.getAll<PageDep>(
          `select id, page_id, depends_on_page_id, threshold_pct from page_dependencies
           where folder_id in (select id from folders where id = ? or parent_id = ?)`,
          [rootId, rootId],
        );
      const folders = await supabase
        .from('folders')
        .select('id')
        .or(`id.eq.${rootId},parent_id.eq.${rootId}`);
      if (folders.error) throw folders.error;
      const { data, error } = await supabase
        .from('page_dependencies')
        .select('id, page_id, depends_on_page_id, threshold_pct')
        .in(
          'folder_id',
          folders.data.map((f) => f.id),
        );
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Dependência entre listas do projeto (V3 §2.3): as ligações, o progresso de cada lista e quais
 * estão bloqueadas. O progresso sai das tarefas do projeto (mesma consulta do Fluxo).
 */
export function usePageDeps(root: FolderNode | undefined) {
  const raw = useRawPageDeps(root?.id);
  const deps = raw.data ?? [];
  const tasks = useProjectAllTasks(deps.length ? root : undefined);
  const byPage = new Map<string, { id: string; parent_task_id: string | null; status: string }[]>();
  for (const t of tasks.data ?? []) byPage.set(t.page_id, [...(byPage.get(t.page_id) ?? []), t]);
  const progress = new Map<string, PageProgress>(
    [...byPage.entries()].map(([id, list]) => [id, pageProgress(list)]),
  );
  return {
    deps,
    progress,
    blocked: blockedPages(deps, progress),
    blockersOf: (pageId: string) => pageBlockers(pageId, deps, progress),
  };
}

/** Ligar, mudar o percentual e desligar listas (dependency.manage). */
export function usePageDepMutations(rootId: string | undefined) {
  const queryClient = useQueryClient();
  const settle = () => {
    queryClient.invalidateQueries({ queryKey: depsKey(rootId ?? '') });
    invalidateWhenIdle(queryClient);
    queryClient.invalidateQueries({ queryKey: keys.tasks });
  };
  const networkMode = isLocal() ? ('always' as const) : ('online' as const);
  return {
    add: useMutation({
      networkMode,
      mutationFn: async ({
        pageId,
        dependsOn,
        threshold,
      }: {
        pageId: string;
        dependsOn: string;
        threshold: number;
      }) => {
        const id = uuidv7();
        if (isLocal()) {
          const page = await db.getOptional<{ folder_id: string }>(
            'select folder_id from pages where id = ?',
            [pageId],
          );
          const now = new Date().toISOString();
          await localInsert('page_dependencies', {
            id,
            page_id: pageId,
            depends_on_page_id: dependsOn,
            threshold_pct: threshold,
            folder_id: page?.folder_id ?? null,
            created_at: now,
            updated_at: now,
            version: 1,
          });
          return;
        }
        const { error } = await supabase.from('page_dependencies').insert({
          id,
          page_id: pageId,
          depends_on_page_id: dependsOn,
          threshold_pct: threshold,
        } as never);
        if (error) throw error;
      },
      onSettled: settle,
    }),
    setThreshold: useMutation({
      networkMode,
      mutationFn: async ({ id, threshold }: { id: string; threshold: number }) => {
        if (isLocal()) {
          await db.execute('update page_dependencies set threshold_pct = ? where id = ?', [
            threshold,
            id,
          ]);
          return;
        }
        const { error } = await supabase
          .from('page_dependencies')
          .update({ threshold_pct: threshold })
          .eq('id', id);
        if (error) throw error;
      },
      onSettled: settle,
    }),
    remove: useMutation({
      networkMode,
      mutationFn: async (id: string) => {
        if (isLocal()) {
          await db.execute('delete from page_dependencies where id = ?', [id]);
          return;
        }
        const { error } = await supabase.from('page_dependencies').delete().eq('id', id);
        if (error) throw error;
      },
      onSettled: settle,
    }),
  };
}
