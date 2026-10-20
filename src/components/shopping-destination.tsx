import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ActionMenu, type MenuAction } from '@/components/ui/dialog';
import { setBatchDraft } from '@/lib/batch-draft';
import { actorCan } from '@/lib/permissions';
import { useFolderActor } from '@/lib/queries/projects';
import { pageLabel, useTree, useTreeMutations, type Page } from '@/lib/queries/tree';
import { useToast } from '@/providers/toast';

/**
 * Para onde vai a lista de compras gerada (PB4, D224): uma lista da mesma pasta, uma lista nova
 * "Compras" ou a Caixa de entrada. Abre a criação em lote com o texto, para conferir antes.
 */
export function ShoppingDestination({
  page,
  text,
  onClose,
}: {
  page: Page;
  text: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const tree = useTree();
  const m = useTreeMutations();
  const toast = useToast();
  const actor = useFolderActor(page.folder_id);

  function open(pageId: string) {
    setBatchDraft(pageId, text);
    router.push('/batch');
  }

  const siblings = (tree.data?.pages ?? []).filter(
    (p) =>
      p.folder_id === page.folder_id &&
      p.id !== page.id &&
      p.view_type === 'list' &&
      !p.is_inbox &&
      !p.is_habits,
  );
  const inbox = tree.data?.inbox;
  const actions: MenuAction[] = [
    ...siblings.map((p) => ({ label: pageLabel(p), onPress: () => open(p.id) })),
    ...(actorCan(actor, 'page.manage')
      ? [
          {
            label: t('shopping.newPage'),
            onPress: () =>
              m.createPage
                .mutateAsync({ folderId: page.folder_id, name: t('shopping.pageName') })
                .then(open, (err: Error) =>
                  toast({ message: t('common.loadError', { message: err.message }) }),
                ),
          },
        ]
      : []),
    ...(inbox ? [{ label: t('nav.inbox'), onPress: () => open(inbox.id) }] : []),
  ];

  return <ActionMenu title={t('shopping.where')} actions={actions} onClose={onClose} />;
}
