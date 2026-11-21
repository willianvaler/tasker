import { useQueryClient } from '@tanstack/react-query';

import type { Json } from '@/lib/db';
import {
  allViews,
  pageViews,
  personalViews,
  removeView,
  upsertView,
  writePageViews,
  writePersonalViews,
  type ListView,
  type ScopedView,
  type ViewScope,
} from '@/lib/list-views';
import { actorCan } from '@/lib/permissions';
import { keys } from '@/lib/queries/keys';
import { useUiPrefs, useUpdateUiPrefs } from '@/lib/queries/profile';
import { rootFolder, useFolderActor } from '@/lib/queries/projects';
import { useTree, useTreeMutations, type Page, type Tree } from '@/lib/queries/tree';
import { useToast } from '@/providers/toast';
import { useCanWrite } from '@/providers/write';
import { useTranslation } from 'react-i18next';

/**
 * As visões salvas de uma lista (VS1, D317): as do projeto (em `pages.config.views`, gravar pede
 * `page.manage`) e as minhas (em `ui_prefs.list_views`, só em projeto: fora dele a lista é só
 * minha e tudo fica na lista).
 */
export function useListViews(page: Page | undefined) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const tree = useTree();
  const prefs = useUiPrefs();
  const updatePrefs = useUpdateUiPrefs();
  const { updatePage } = useTreeMutations();
  const actor = useFolderActor(page?.folder_id);
  const manage = useCanWrite(page?.folder_id, { offline: true }) && actorCan(actor, 'page.manage');
  const shared = !!rootFolder(tree.data, page?.folder_id)?.is_shared;
  const project = pageViews(page?.config);
  const personal = page && shared ? personalViews(prefs.list_views, page.id) : [];
  const views = allViews(project, personal);
  const onError = (err: Error) => toast({ message: t('page.error', { message: err.message }) });

  function writeProject(next: ListView[]) {
    if (!page) return;
    const config = writePageViews(page.config, next) as Json;
    // A aba aparece na hora (a árvore só recarrega depois da resposta, e sem conexão nem isso)
    queryClient.setQueryData<Tree>(keys.tree, (data) =>
      data
        ? { ...data, pages: data.pages.map((p) => (p.id === page.id ? { ...p, config } : p)) }
        : data,
    );
    updatePage.mutate({ id: page.id, name: page.name, config }, { onError });
  }
  function writePersonal(next: ListView[]) {
    if (!page) return;
    updatePrefs.mutate(
      { list_views: writePersonalViews(prefs.list_views, page.id, next) as Record<string, Json> },
      { onError },
    );
  }

  /** Quem pode mexer nesta visão: a minha, sempre; a do projeto, com `page.manage`. */
  const canEdit = (view: ScopedView) => view.scope === 'personal' || manage;

  function save(view: ListView, scope: ViewScope, previous?: ScopedView) {
    // Mudou de "só minha" para "do projeto" (ou o contrário): sai de um lugar e entra no outro
    if (previous && previous.scope !== scope) {
      if (previous.scope === 'project') writeProject(removeView(project, view.id));
      else writePersonal(removeView(personal, view.id));
    }
    if (scope === 'project') writeProject(upsertView(project, view));
    else writePersonal(upsertView(personal, view));
  }

  function remove(view: ScopedView) {
    if (view.scope === 'project') writeProject(removeView(project, view.id));
    else writePersonal(removeView(personal, view.id));
  }

  return { views, manage, shared, canEdit, save, remove };
}
