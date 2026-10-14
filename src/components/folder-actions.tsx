import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { FolderDialog as FolderForm } from '@/components/folder-dialog';
import { PageDialog } from '@/components/page-dialog';
import {
  ActionMenu,
  ConfirmDialog,
  PromptDialog,
  useDialog,
  type MenuAction,
} from '@/components/ui/dialog';
import { rootFolder, useTemplateMutations } from '@/lib/queries/projects';
import { pageLabel, useTree, useTreeMutations, type Folder, type Page } from '@/lib/queries/tree';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

type FolderDialog =
  | { kind: 'folder-menu'; folder: Folder }
  | { kind: 'page-menu'; page: Page }
  | { kind: 'move-page'; page: Page }
  | { kind: 'new-folder'; parentId?: string; project?: boolean }
  | { kind: 'new-page'; folderId: string }
  | { kind: 'edit-folder'; folder: Folder }
  | { kind: 'edit-page'; page: Page }
  | { kind: 'delete-folder'; folder: Folder }
  | { kind: 'delete-page'; page: Page }
  | { kind: 'save-template'; folder: Folder };

/**
 * Criar, renomear e apagar pastas e páginas. Usado pela barra lateral, pela aba Pastas e pela
 * tela da pasta. Devolve as ações e o elemento com o diálogo aberto (renderize-o na tela).
 */
export function useFolderActions() {
  const m = useTreeMutations();
  const templates = useTemplateMutations();
  const { session } = useSession();
  const tree = useTree();
  const toast = useToast();
  const [dialog, setDialog, close] = useDialog<FolderDialog>();
  const { t } = useTranslation();

  const onError = (err: Error) => toast({ message: t('page.error', { message: err.message }) });

  const actions = {
    newFolder: (parentId?: string) => setDialog({ kind: 'new-folder', parentId }),
    newProject: () => setDialog({ kind: 'new-folder', project: true }),
    newPage: (folderId: string) => setDialog({ kind: 'new-page', folderId }),
    folderMenu: (folder: Folder) => setDialog({ kind: 'folder-menu', folder }),
    pageMenu: (page: Page) => setDialog({ kind: 'page-menu', page }),
    movePage: (page: Page) => setDialog({ kind: 'move-page', page }),
  };

  function folderMenu(folder: Folder): MenuAction[] {
    // Só o dono do projeto apaga (a RLS também barra; aqui só some do menu)
    const owner = rootFolder(tree.data, folder.id)?.owner_id ?? folder.owner_id;
    const isOwner = owner === session?.user.id;
    return [
      {
        label: t(folder.kind === 'project' ? 'project.item.new' : 'folder.newPage'),
        onPress: () => actions.newPage(folder.id),
      },
      // Máximo de 2 níveis de pasta
      ...(folder.parent_id
        ? []
        : [
            { label: t('folder.newSubfolder'), onPress: () => actions.newFolder(folder.id) },
            {
              label: folder.is_shared ? t('folder.peopleInvite') : t('folder.share'),
              onPress: () => router.push({ pathname: '/share/[id]', params: { id: folder.id } }),
            },
            {
              label: t('folder.saveTemplate'),
              onPress: () => setDialog({ kind: 'save-template', folder }),
            },
          ]),
      { label: t('folder.rename'), onPress: () => setDialog({ kind: 'edit-folder', folder }) },
      ...(isOwner
        ? [
            {
              label: t('folder.delete'),
              destructive: true,
              onPress: () => setDialog({ kind: 'delete-folder', folder }),
            },
          ]
        : []),
    ];
  }

  function pageMenu(page: Page): MenuAction[] {
    return [
      { label: t('folder.configure'), onPress: () => setDialog({ kind: 'edit-page', page }) },
      { label: t('folder.moveTo'), onPress: () => setDialog({ kind: 'move-page', page }) },
      {
        label: t('folder.deletePage'),
        destructive: true,
        onPress: () => setDialog({ kind: 'delete-page', page }),
      },
    ];
  }

  let element = null;
  if (dialog?.kind === 'folder-menu')
    element = (
      <ActionMenu title={dialog.folder.name} actions={folderMenu(dialog.folder)} onClose={close} />
    );
  else if (dialog?.kind === 'page-menu')
    element = (
      <ActionMenu title={pageLabel(dialog.page)} actions={pageMenu(dialog.page)} onClose={close} />
    );
  else if (dialog?.kind === 'move-page') {
    const page = dialog.page;
    // Destinos: todas as pastas e projetos (e subpastas), menos a pasta atual
    const targets = (tree.data?.folders ?? []).flatMap((root) => [
      { id: root.id, label: root.name },
      ...root.children.map((child) => ({ id: child.id, label: `${root.name} / ${child.name}` })),
    ]);
    element = (
      <ActionMenu
        title={t('folder.moveTitle', { name: page.name })}
        actions={targets
          .filter((target) => target.id !== page.folder_id)
          .map((target) => ({
            label: target.label,
            onPress: () =>
              m.movePage.mutate(
                { id: page.id, folderId: target.id },
                {
                  onError,
                  onSuccess: () => toast({ message: t('folder.moved', { name: target.label }) }),
                },
              ),
          }))}
        onClose={close}
      />
    );
  } else if (dialog?.kind === 'new-folder' || dialog?.kind === 'edit-folder') {
    const editing = dialog.kind === 'edit-folder' ? dialog.folder : null;
    const parentId = dialog.kind === 'new-folder' ? dialog.parentId : undefined;
    const project = dialog.kind === 'new-folder' ? !!dialog.project : editing?.kind === 'project';
    element = (
      <FolderForm
        title={t(
          editing
            ? 'folder.renameTitle'
            : parentId
              ? 'folder.newSubfolder'
              : project
                ? 'folder.newProject'
                : 'folder.newFolder',
        )}
        placeholder={t(project ? 'folder.projectPlaceholder' : 'folder.namePlaceholder')}
        project={project}
        initial={editing ?? undefined}
        onClose={close}
        onConfirm={({ name, icon, color }) => {
          if (editing) m.updateFolder.mutate({ id: editing.id, name, icon, color }, { onError });
          else
            m.createFolder.mutate(
              { name, icon, color, parentId, kind: project ? 'project' : 'folder' },
              // Abre a pasta nova: o próximo passo é criar páginas nela
              {
                onError,
                onSuccess: (id) => router.navigate({ pathname: '/folder/[id]', params: { id } }),
              },
            );
          close();
        }}
      />
    );
  } else if (dialog?.kind === 'new-page' || dialog?.kind === 'edit-page') {
    const editing = dialog.kind === 'edit-page' ? dialog.page : null;
    const folderId = dialog.kind === 'new-page' ? dialog.folderId : '';
    element = (
      <PageDialog
        title={t(
          editing
            ? 'page.settings'
            : rootFolder(tree.data, folderId)?.kind === 'project'
              ? 'project.item.new'
              : 'pageDialog.new',
        )}
        initial={editing ?? undefined}
        onClose={close}
        onConfirm={(settings) => {
          if (editing) m.updatePage.mutate({ id: editing.id, ...settings }, { onError });
          else
            m.createPage.mutate(
              { folderId, ...settings },
              // Abre a página nova: o próximo passo é sempre colocar coisas nela
              {
                onError,
                onSuccess: (id) => router.navigate({ pathname: '/page/[id]', params: { id } }),
              },
            );
          close();
        }}
      />
    );
  } else if (dialog?.kind === 'delete-folder') {
    const folder = dialog.folder;
    element = (
      <ConfirmDialog
        title={t('folder.deleteTitle', { name: folder.name })}
        message={t('folder.deleteMessage')}
        confirmLabel={t('folder.deleteConfirm')}
        onClose={close}
        onConfirm={() => {
          m.deleteFolder.mutate(folder.id, { onError });
          close();
        }}
      />
    );
  } else if (dialog?.kind === 'save-template') {
    const folder = dialog.folder;
    element = (
      <PromptDialog
        title={t('folder.saveTemplate')}
        fields={[{ key: 'name', placeholder: t('folder.templateName'), initial: folder.name }]}
        onClose={close}
        onConfirm={({ name }) => {
          templates.saveFolder.mutate(
            { folder, name },
            {
              onError,
              onSuccess: () => toast({ message: t('folder.templateSaved', { name }) }),
            },
          );
          close();
        }}
      />
    );
  } else if (dialog?.kind === 'delete-page') {
    const page = dialog.page;
    element = (
      <ConfirmDialog
        title={t('folder.deleteTitle', { name: page.name })}
        message={t('folder.deletePageMessage')}
        confirmLabel={t('folder.deleteConfirm')}
        onClose={close}
        onConfirm={() => {
          m.deletePage.mutate(page.id, { onError });
          close();
        }}
      />
    );
  }

  return [actions, element] as const;
}
