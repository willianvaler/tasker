import { Link, router, usePathname, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFolderActions } from '@/components/folder-actions';
import { SidebarGame } from '@/components/game-bar';
import { Badge, useUnreadCount } from '@/components/notifications-bell';
import { folderLabel, MenuButton } from '@/components/folder-cards';
import { cn } from '@/lib/cn';
import { getOpenFolders, setOpenFolders } from '@/lib/prefs';
import { pageLabel, useTree, type Page, type SubFolder } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';

/** Largura a partir da qual as abas viram barra lateral (ESCOPO 5). */
export const WIDE = 768;

export function useIsWide() {
  return useWindowDimensions().width >= WIDE;
}

const NAV: { href: Href & string; label: string; icon: string }[] = [
  { href: '/', label: 'Hoje', icon: '☀️' },
  { href: '/inbox', label: 'Caixa de entrada', icon: '📥' },
  { href: '/mine', label: 'Minhas tarefas', icon: '🙋' },
  { href: '/folders', label: 'Pastas', icon: '📁' },
  { href: '/clan', label: 'Clã', icon: '🛡️' },
  { href: '/profile', label: 'Perfil', icon: '👤' },
];

/**
 * Barra lateral da web em tela larga: atalhos, botão de nova pasta e a árvore de pastas e
 * páginas (recolhível). Fica fora da pilha de telas, então continua visível dentro das páginas.
 */
export function Sidebar() {
  const pathname = usePathname();
  const tree = useTree();
  const online = useIsOnline();
  const [actions, dialog] = useFolderActions();
  const unread = useUnreadCount();
  const [open, setOpen] = useState(() => new Set(getOpenFolders()));

  // Pasta da tela atual (a própria pasta, ou a pasta da página aberta)
  const routeId = /^\/(?:folder|page)\/([^/]+)/.exec(pathname)?.[1];
  const activeFolderId = pathname.startsWith('/page/')
    ? tree.data?.pages.find((p) => p.id === routeId)?.folder_id
    : routeId;
  const activeRootId = tree.data?.folders.find(
    (f) => f.id === activeFolderId || f.children.some((c) => c.id === activeFolderId),
  )?.id;

  // Abre o caminho até a tela atual, para o item ativo aparecer (ajuste de estado no render,
  // só quando a tela muda)
  const activeKey = `${activeRootId}/${activeFolderId}`;
  const [openedFor, setOpenedFor] = useState('');
  if (openedFor !== activeKey) {
    setOpenedFor(activeKey);
    const ids = [activeRootId, activeFolderId].filter((id): id is string => !!id);
    if (!ids.every((id) => open.has(id))) setOpen(new Set([...open, ...ids]));
  }

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setOpenFolders([...next]);
      return next;
    });
  }

  function renderFolder(folder: SubFolder & { children?: SubFolder[] }, depth: number) {
    const expanded = open.has(folder.id);
    const children = folder.children ?? [];
    const label = folderLabel(folder);
    return (
      <View key={folder.id}>
        <Row
          depth={depth}
          href={`/folder/${folder.id}`}
          label={label}
          active={pathname === `/folder/${folder.id}`}
          expanded={expanded}
          onToggle={() => toggle(folder.id)}
          onMenu={online ? () => actions.folderMenu(folder) : undefined}
        />
        {expanded && (
          <>
            {folder.pages.map((page) => renderPage(page, depth + 1))}
            {children.map((child) => renderFolder(child, depth + 1))}
            {folder.pages.length === 0 && children.length === 0 && online && (
              <Pressable
                accessibilityRole="button"
                className="min-h-9 justify-center rounded-lg active:bg-muted"
                style={{ paddingLeft: 12 + (depth + 1) * 16 + 20 }}
                onPress={() => actions.newPage(folder.id)}
              >
                <Text className="text-sm text-primary">+ Nova página</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    );
  }

  function renderPage(page: Page, depth: number) {
    return (
      <Row
        key={page.id}
        depth={depth}
        href={`/page/${page.id}`}
        label={pageLabel(page)}
        active={pathname === `/page/${page.id}`}
      />
    );
  }

  const folders = tree.data?.folders ?? [];

  return (
    <SafeAreaView
      edges={['top', 'left', 'bottom']}
      className="w-64 border-r border-border bg-card"
      role="navigation"
    >
      <View className="gap-1 px-3 pt-4">
        <Text className="mb-2 px-2 text-lg font-bold text-foreground">Questlist</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nova tarefa"
          className="mb-2 min-h-10 flex-row items-center gap-2 rounded-lg border border-border bg-background px-3 active:bg-muted"
          onPress={() => router.push('/capture')}
        >
          <Text className="text-base text-primary">＋</Text>
          <Text className="flex-1 text-sm font-medium text-foreground">Nova tarefa</Text>
          <Text className="text-xs text-muted-foreground">N</Text>
        </Pressable>
        <View>
          {NAV.map((item) => {
            const selected =
              pathname === item.href ||
              (item.href === '/folders' && pathname.startsWith('/folder/'));
            return (
              <Link key={item.href} href={item.href} asChild>
                <Pressable
                  accessibilityRole="link"
                  aria-current={selected ? 'page' : undefined}
                  className={cn(
                    'min-h-10 flex-row items-center gap-3 rounded-lg px-2 active:bg-muted',
                    selected && 'bg-muted',
                  )}
                >
                  <Text style={{ fontSize: 16, lineHeight: 20 }}>{item.icon}</Text>
                  <Text
                    className={cn(
                      'text-sm text-foreground',
                      selected ? 'font-semibold' : 'font-normal',
                    )}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              </Link>
            );
          })}
          <Link href="/notifications" asChild>
            <Pressable
              accessibilityRole="link"
              aria-current={pathname === '/notifications' ? 'page' : undefined}
              accessibilityLabel={unread ? `Notificações: ${unread} novas` : 'Notificações'}
              className={cn(
                'min-h-10 flex-row items-center gap-3 rounded-lg px-2 active:bg-muted',
                pathname === '/notifications' && 'bg-muted',
              )}
            >
              <Text style={{ fontSize: 16, lineHeight: 20 }}>🔔</Text>
              <Text className="flex-1 text-sm text-foreground">Notificações</Text>
              {unread > 0 && <Badge count={unread} />}
            </Pressable>
          </Link>
        </View>
      </View>

      <View className="mt-5 flex-row items-center pl-5 pr-3">
        <Text className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pastas
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nova pasta"
          disabled={!online}
          aria-disabled={!online}
          className={cn(
            'h-8 w-8 items-center justify-center rounded-lg active:bg-muted',
            !online && 'opacity-50',
          )}
          onPress={() => actions.newFolder()}
        >
          <Text className="text-lg text-muted-foreground">+</Text>
        </Pressable>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="px-3 pb-6">
        {folders.map((folder) => renderFolder(folder, 0))}
        {tree.data && folders.length === 0 && (
          <Pressable
            accessibilityRole="button"
            disabled={!online}
            className="mt-1 min-h-10 justify-center rounded-lg border border-dashed border-border px-3 active:bg-muted"
            onPress={() => actions.newFolder()}
          >
            <Text className="text-sm text-muted-foreground">+ Criar a primeira pasta</Text>
          </Pressable>
        )}
      </ScrollView>
      <SidebarGame />
      {dialog}
    </SafeAreaView>
  );
}

function Row({
  depth,
  href,
  label,
  active,
  expanded,
  onToggle,
  onMenu,
}: {
  depth: number;
  href: Href & string;
  label: string;
  active: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onMenu?: () => void;
}) {
  return (
    <View
      className={cn('min-h-9 flex-row items-center rounded-lg', active && 'bg-muted')}
      style={{ paddingLeft: depth * 16 }}
    >
      {onToggle ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? 'Recolher' : 'Expandir'} ${label}`}
          aria-expanded={expanded}
          className="h-9 w-7 items-center justify-center rounded active:bg-muted"
          onPress={onToggle}
        >
          <Text className="text-xs text-muted-foreground">{expanded ? '▾' : '▸'}</Text>
        </Pressable>
      ) : (
        <View className="w-7" />
      )}
      <Link href={href} asChild>
        <Pressable
          accessibilityRole="link"
          aria-current={active ? 'page' : undefined}
          className="min-h-9 flex-1 justify-center active:opacity-60"
        >
          <Text
            className={cn('text-sm text-foreground', active && 'font-semibold')}
            numberOfLines={1}
          >
            {label}
          </Text>
        </Pressable>
      </Link>
      {onMenu && <MenuButton label={label} onPress={onMenu} />}
    </View>
  );
}
