import { router } from 'expo-router';

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
  | { kind: 'new-folder'; parentId?: string }
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

  const onError = (err: Error) => toast({ message: `Não deu certo: ${err.message}` });

  const actions = {
    newFolder: (parentId?: string) => setDialog({ kind: 'new-folder', parentId }),
    newPage: (folderId: string) => setDialog({ kind: 'new-page', folderId }),
    folderMenu: (folder: Folder) => setDialog({ kind: 'folder-menu', folder }),
    pageMenu: (page: Page) => setDialog({ kind: 'page-menu', page }),
  };

  function folderMenu(folder: Folder): MenuAction[] {
    // Só o dono do projeto apaga (a RLS também barra; aqui só some do menu)
    const owner = rootFolder(tree.data, folder.id)?.owner_id ?? folder.owner_id;
    const isOwner = owner === session?.user.id;
    return [
      { label: '📄 Nova página', onPress: () => actions.newPage(folder.id) },
      // Máximo de 2 níveis de pasta (ESCOPO 1.2)
      ...(folder.parent_id
        ? []
        : [
            { label: '📁 Nova subpasta', onPress: () => actions.newFolder(folder.id) },
            {
              label: folder.is_shared ? '👥 Pessoas e convite' : '👥 Compartilhar',
              onPress: () => router.push({ pathname: '/share/[id]', params: { id: folder.id } }),
            },
            {
              label: '💾 Salvar como modelo',
              onPress: () => setDialog({ kind: 'save-template', folder }),
            },
          ]),
      { label: '✏️ Renomear', onPress: () => setDialog({ kind: 'edit-folder', folder }) },
      ...(isOwner
        ? [
            {
              label: '🗑️ Apagar pasta',
              destructive: true,
              onPress: () => setDialog({ kind: 'delete-folder', folder }),
            },
          ]
        : []),
    ];
  }

  function pageMenu(page: Page): MenuAction[] {
    return [
      { label: '⚙️ Configurar', onPress: () => setDialog({ kind: 'edit-page', page }) },
      {
        label: '🗑️ Apagar página',
        destructive: true,
        onPress: () => setDialog({ kind: 'delete-page', page }),
      },
    ];
  }

  let element = null;
  if (dialog?.kind === 'folder-menu')
    element = (
      <ActionMenu
        title={`${dialog.folder.icon || '📁'} ${dialog.folder.name}`}
        actions={folderMenu(dialog.folder)}
        onClose={close}
      />
    );
  else if (dialog?.kind === 'page-menu')
    element = (
      <ActionMenu title={pageLabel(dialog.page)} actions={pageMenu(dialog.page)} onClose={close} />
    );
  else if (dialog?.kind === 'new-folder' || dialog?.kind === 'edit-folder') {
    const editing = dialog.kind === 'edit-folder' ? dialog.folder : null;
    const parentId = dialog.kind === 'new-folder' ? dialog.parentId : undefined;
    element = (
      <PromptDialog
        title={editing ? 'Renomear pasta' : parentId ? 'Nova subpasta' : 'Nova pasta'}
        fields={[
          { key: 'name', placeholder: 'Nome (ex.: Academia)', initial: editing?.name ?? '' },
          {
            key: 'icon',
            placeholder: 'Emoji (opcional, ex.: 🏋️)',
            maxLength: 8,
            initial: editing?.icon ?? '',
          },
        ]}
        onClose={close}
        onConfirm={({ name, icon }) => {
          if (editing) m.updateFolder.mutate({ id: editing.id, name, icon }, { onError });
          else
            m.createFolder.mutate(
              { name, icon, parentId },
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
        title={editing ? 'Configurar página' : 'Nova página'}
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
        title={`Apagar "${folder.name}"?`}
        message="As subpastas, páginas e tarefas dentro dela também serão apagadas."
        confirmLabel="Apagar"
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
        title="Salvar como modelo"
        fields={[{ key: 'name', placeholder: 'Nome do modelo', initial: folder.name }]}
        onClose={close}
        onConfirm={({ name }) => {
          templates.saveFolder.mutate(
            { folder, name },
            {
              onError,
              onSuccess: () =>
                toast({ message: `Modelo "${name}" salvo. Use em Pastas → Usar modelo.` }),
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
        title={`Apagar "${page.name}"?`}
        message="As tarefas da página também serão apagadas."
        confirmLabel="Apagar"
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
