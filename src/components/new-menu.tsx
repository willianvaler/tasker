import { router, usePathname } from 'expo-router';
import {
  CheckSquare,
  FileText,
  Folder,
  LayoutTemplate,
  ListPlus,
  NotebookPen,
  Repeat,
  SlidersHorizontal,
  Users,
} from 'lucide-react-native';
import { createContext, useContext, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useFolderActions } from '@/components/folder-actions';
import { Icon } from '@/components/ui/icon';
import { MenuItem, Popover } from '@/components/ui/popover';
import { Text } from '@/components/ui/text';
import { useNewNote } from '@/components/notes-block';
import { setBatchDraft } from '@/lib/batch-draft';
import { captureContext, captureTargetId, folderScope } from '@/lib/capture-target';
import { getLastPageId } from '@/lib/prefs';
import { useTree } from '@/lib/queries/tree';
import { useShortcut } from '@/lib/use-shortcut';

type NewMenu = { open: (anchor?: RefObject<View | null>) => void };
const NewMenuContext = createContext<NewMenu>({ open: () => {} });

/** Abre o menu "+ Novo" (barra lateral, botão + do celular, Alt/Ctrl+N). */
export function useNewMenu() {
  return useContext(NewMenuContext);
}

/**
 * Menu "+ Novo": Tarefa · Página · Pasta · Projeto · Hábito · Anotação, e embaixo Várias de uma
 * vez, A partir de um modelo e Criação avançada, com letras de atalho (D261: o lugar de criar
 * tudo; lote e modelos ficavam só dentro da lista e num ícone da tela Pastas). O contexto decide o
 * destino: dentro de uma pasta ou projeto, "Página", a anotação e o lote vão para ele.
 */
export function NewMenuProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const tree = useTree();
  const [actions, dialog] = useFolderActions();
  const fallbackAnchor = useRef<View>(null);
  const [anchor, setAnchor] = useState<RefObject<View | null> | null>(null);
  const open = anchor !== null;
  const close = () => setAnchor(null);

  // Pasta da tela atual (pasta aberta ou pasta da página aberta); senão, a primeira
  const routeId = /^\/(?:folder|page)\/([^/]+)/.exec(pathname)?.[1];
  const contextFolder = pathname.startsWith('/page/')
    ? tree.data?.pages.find((p) => p.id === routeId)?.folder_id
    : routeId;
  const pageTarget = contextFolder ?? tree.data?.folders[0]?.id;
  const newNote = useNewNote(contextFolder ?? null);
  // Lote: a página aberta, a da pasta aberta ou a Caixa de entrada (como a captura, CD19)
  const batchTarget = () =>
    captureTargetId(
      captureContext(pathname),
      tree.data?.pages ?? [],
      (id) => folderScope(tree.data?.folders, id),
      getLastPageId(),
    ) ?? tree.data?.inbox?.id;

  const run = (action: () => void) => () => {
    close();
    // Depois do menu fechar: o Modal da web devolve o foco ao elemento anterior ao sair, e
    // roubaria o foco do campo do diálogo que a ação abre
    setTimeout(action, 0);
  };
  const items = [
    {
      id: 'new.task',
      label: t('newMenu.task'),
      key: 'T',
      icon: CheckSquare,
      // Na pasta ou página atual, não na última visitada
      onPress: run(() => router.push({ pathname: '/capture', params: captureContext(pathname) })),
    },
    {
      id: 'new.page',
      label: t('newMenu.page'),
      key: 'P',
      icon: FileText,
      // Sem nenhuma pasta ainda, o primeiro passo é criar uma
      onPress: run(() => (pageTarget ? actions.newPage(pageTarget) : actions.newFolder())),
    },
    {
      id: 'new.folder',
      label: t('newMenu.folder'),
      key: 'F',
      icon: Folder,
      onPress: run(() => actions.newFolder()),
    },
    {
      id: 'new.project',
      label: t('newMenu.project'),
      key: 'J',
      icon: Users,
      onPress: run(() => actions.newProject()),
    },
    {
      id: 'new.habit',
      label: t('newMenu.habit'),
      key: 'H',
      icon: Repeat,
      onPress: run(() => router.push('/habits')),
    },
    {
      id: 'new.note',
      label: t('newMenu.note'),
      key: 'A',
      icon: NotebookPen,
      onPress: run(newNote),
    },
    {
      id: 'new.batch',
      label: t('newMenu.batch'),
      key: 'V',
      icon: ListPlus,
      divider: true,
      onPress: run(() => {
        const target = batchTarget();
        if (!target) return;
        setBatchDraft(target, '');
        router.push('/batch');
      }),
    },
    {
      id: 'new.template',
      label: t('newMenu.template'),
      key: 'M',
      icon: LayoutTemplate,
      onPress: run(() => router.push('/templates')),
    },
    {
      id: 'new.advanced',
      label: t('newMenu.advanced'),
      key: 'Alt ⇧ N',
      icon: SlidersHorizontal,
      onPress: run(() =>
        router.push({
          pathname: '/task/new',
          params: captureContext(pathname),
        }),
      ),
    },
  ] as const;

  useShortcut('new.open', () => setAnchor(fallbackAnchor));
  useShortcut('new.task', items[0].onPress, open);
  useShortcut('new.page', items[1].onPress, open);
  useShortcut('new.folder', items[2].onPress, open);
  useShortcut('new.project', items[3].onPress, open);
  useShortcut('new.habit', items[4].onPress, open);
  useShortcut('new.note', items[5].onPress, open);
  useShortcut('new.batch', items[6].onPress, open);
  useShortcut('new.template', items[7].onPress, open);

  return (
    <NewMenuContext.Provider value={{ open: (a) => setAnchor(a ?? fallbackAnchor) }}>
      {children}
      {/* Âncora de quando o menu abre pelo teclado: canto de cima, à esquerda */}
      <View ref={fallbackAnchor} collapsable={false} className="absolute left-2 top-2 h-px w-px" />
      <Popover
        anchor={anchor ?? fallbackAnchor}
        open={open}
        onClose={close}
        placement={anchor === fallbackAnchor ? 'center' : 'below'}
      >
        <Text className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {t('newMenu.title')}
        </Text>
        {items.map((item) => (
          <View key={item.id}>
            {'divider' in item && <View className="my-1 h-px bg-line" />}
            <MenuItem
              label={item.label}
              shortcut={item.key}
              icon={<Icon icon={item.icon} tone="ink-muted" />}
              onPress={item.onPress}
            />
          </View>
        ))}
      </Popover>
      {dialog}
    </NewMenuContext.Provider>
  );
}
