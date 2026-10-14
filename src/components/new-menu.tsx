import { router, usePathname } from 'expo-router';
import {
  CheckSquare,
  FileText,
  Folder,
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
import { useTree } from '@/lib/queries/tree';
import { useShortcut } from '@/lib/use-shortcut';

type NewMenu = { open: (anchor?: RefObject<View | null>) => void };
const NewMenuContext = createContext<NewMenu>({ open: () => {} });

/** Abre o menu "+ Novo" (barra lateral, botão + do celular, Alt/Ctrl+N). */
export function useNewMenu() {
  return useContext(NewMenuContext);
}

/**
 * Menu "+ Novo" (V2 §5.3): Tarefa · Página · Pasta · Projeto · Hábito, com letras de atalho.
 * O contexto decide o destino: dentro de uma pasta ou projeto, "Página" cria nele.
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

  const run = (action: () => void) => () => {
    close();
    action();
  };
  const items = [
    {
      id: 'new.task',
      label: t('newMenu.task'),
      key: 'T',
      icon: CheckSquare,
      onPress: run(() => router.push('/capture')),
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
      id: 'new.advanced',
      label: t('newMenu.advanced'),
      key: 'Alt ⇧ N',
      icon: SlidersHorizontal,
      onPress: run(() =>
        router.push({
          pathname: '/task/new',
          params: pathname.startsWith('/page/') && routeId ? { page: routeId } : {},
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

  return (
    <NewMenuContext.Provider value={{ open: (a) => setAnchor(a ?? fallbackAnchor) }}>
      {children}
      {/* Âncora de quando o menu abre pelo teclado: canto de cima, à esquerda */}
      <View ref={fallbackAnchor} collapsable={false} className="absolute left-2 top-2 h-px w-px" />
      <Popover anchor={anchor ?? fallbackAnchor} open={open} onClose={close}>
        <Text className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {t('newMenu.title')}
        </Text>
        {items.map((item) => (
          <MenuItem
            key={item.id}
            label={item.label}
            shortcut={item.key}
            icon={<Icon icon={item.icon} tone="ink-muted" />}
            onPress={item.onPress}
          />
        ))}
      </Popover>
      {dialog}
    </NewMenuContext.Provider>
  );
}
