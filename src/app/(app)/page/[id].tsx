import { router, useLocalSearchParams } from 'expo-router';
import type { TFunction } from 'i18next';
import { MoreHorizontal, SlidersHorizontal } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useFolderActions } from '@/components/folder-actions';
import { ItemIcon, type ItemKind } from '@/components/item-icon';
import { PageDialog } from '@/components/page-dialog';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { PageView } from '@/components/tasks/page-view';
import { IconButton } from '@/components/ui/button';
import { ActionMenu, PromptDialog, useDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { effectiveMaxDepth } from '@/config/limits';
import { rootFolder } from '@/lib/queries/projects';
import { saveTextFile } from '@/lib/download';
import { setLastPageId } from '@/lib/prefs';
import { usePageTasks } from '@/lib/queries/tasks';
import { wbsOutline } from '@/lib/task-tree';
import { findFolder, pageLabel, useTree, useTreeMutations } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

type DialogState = 'menu' | 'settings' | 'duplicate';

export default function PageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tree = useTree();
  const m = useTreeMutations();
  const online = useIsOnline();
  const toast = useToast();
  const [dialog, setDialog, closeDialog] = useDialog<DialogState>();
  const [folderActions, folderDialog] = useFolderActions();
  const { t } = useTranslation();
  const page = tree.data?.pages.find((p) => p.id === id);
  const pageTasks = usePageTasks(id);

  // A captura rápida global usa a última página aberta como destino padrão
  useEffect(() => {
    if (page) setLastPageId(page.id);
  }, [page]);

  if (tree.data && !page) {
    return (
      <Screen>
        <ScreenHeader title={t('page.fallbackTitle')} back />
        <EmptyState title={t('page.missing')} />
      </Screen>
    );
  }

  const onError = (err: Error) => toast({ message: t('page.error', { message: err.message }) });
  // Caminho acima do título: "MERCADO" ou "CASA / COZINHA"
  const place = page ? findFolder(tree.data, page.folder_id) : null;
  const eyebrow = place
    ? [place.parent?.name, place.folder.name].filter(Boolean).join(' / ')
    : undefined;

  // Cards e kanban aproveitam a tela toda; lista e hábitos ficam numa coluna de leitura
  const size = page?.view_type === 'cards' || page?.view_type === 'kanban' ? 'wide' : 'medium';
  return (
    <Screen size={size}>
      <ScreenHeader
        title={page ? pageLabel(page) : ''}
        eyebrow={page?.is_habits || page?.is_inbox ? undefined : eyebrow}
        icon={
          page ? <ItemIcon icon={page.icon} kind={page.view_type as ItemKind} size={20} /> : null
        }
        rename={
          // Páginas de sistema (Caixa de entrada, Hábitos) não mudam de nome
          page && online && !page.is_habits && !page.is_inbox
            ? {
                target: { kind: 'page', id: page.id },
                icon: page.icon,
                iconKind: page.view_type as ItemKind,
                onSave: ({ name, icon }) =>
                  m.updatePage.mutate({ id: page.id, name, icon }, { onError }),
              }
            : undefined
        }
        back
        right={
          // Página de hábitos de sistema: sem configurar nem duplicar
          page && online && !page.is_habits ? (
            <>
              <IconButton
                icon={SlidersHorizontal}
                label={t('page.settings')}
                onPress={() => setDialog('settings')}
              />
              <IconButton
                icon={MoreHorizontal}
                label={t('page.options')}
                onPress={() => setDialog('menu')}
              />
            </>
          ) : null
        }
      />
      <PageView page={page} />
      {folderDialog}

      {page && dialog === 'menu' && (
        <ActionMenu
          title={pageLabel(page)}
          onClose={closeDialog}
          actions={[
            { label: t('page.settings'), onPress: () => setDialog('settings') },
            { label: t('page.duplicate'), onPress: () => setDialog('duplicate') },
            { label: t('folder.moveTo'), onPress: () => folderActions.movePage(page) },
            ...(pageTasks.data?.some((task) => task.parent_task_id)
              ? [
                  {
                    label: t('tree.export'),
                    onPress: () =>
                      saveTextFile(
                        `${page.name}.txt`,
                        wbsOutline(pageTasks.data ?? []),
                        'text/plain',
                      ),
                  },
                ]
              : []),
          ]}
        />
      )}
      {page && dialog === 'settings' && (
        <PageDialog
          title={t('page.settings')}
          initial={page}
          inheritedDepth={effectiveMaxDepth(null, rootFolder(tree.data, page.folder_id)?.max_depth)}
          onClose={closeDialog}
          onConfirm={(settings) => {
            m.updatePage.mutate({ id: page.id, ...settings }, { onError });
            closeDialog();
          }}
        />
      )}
      {page && dialog === 'duplicate' && (
        <PromptDialog
          title={t('page.duplicate')}
          confirmLabel={t('page.duplicateConfirm')}
          fields={[
            { key: 'name', placeholder: t('page.copyName'), initial: nextName(page.name, t) },
          ]}
          onClose={closeDialog}
          onConfirm={({ name }) => {
            closeDialog();
            m.duplicatePage.mutate(
              { id: page.id, name },
              {
                onError,
                onSuccess: (newId) => {
                  toast({ message: t('page.created', { name }) });
                  if (newId) router.replace({ pathname: '/page/[id]', params: { id: newId } });
                },
              },
            );
          }}
        />
      )}
    </Screen>
  );
}

/** "Treino A" → "Treino B"; o resto ganha " (cópia)". */
function nextName(name: string, t: TFunction) {
  const letter = /^(.*\s)([A-Y])$/.exec(name);
  if (letter) return letter[1] + String.fromCharCode(letter[2].charCodeAt(0) + 1);
  return t('page.copySuffix', { name });
}
