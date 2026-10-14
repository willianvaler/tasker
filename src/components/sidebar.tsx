import { Link, usePathname, type Href } from 'expo-router';
import {
  Bell,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  House,
  Inbox,
  LayoutGrid,
  Plus,
  Repeat,
  Search,
  Shield,
  ShoppingBag,
  Sun,
  User,
  UserCheck,
  type LucideIcon,
} from 'lucide-react-native';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCommandPalette } from '@/components/command-palette';
import { useFolderActions } from '@/components/folder-actions';
import { MenuButton } from '@/components/folder-cards';
import { ItemIcon, type ItemKind } from '@/components/item-icon';
import { useNewMenu } from '@/components/new-menu';
import { Badge, useUnreadCount } from '@/components/notifications-bell';
import { ThemeToggle } from '@/components/theme-toggle';
import { IconButton } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { getOpenFolders, setOpenFolders } from '@/lib/prefs';
import { useGameState } from '@/lib/queries/game';
import { useTree, type Page, type SubFolder } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';

/** Largura a partir da qual as abas viram barra lateral (ESCOPO 5). */
export const WIDE = 768;

export function useIsWide() {
  return useWindowDimensions().width >= WIDE;
}

type NavKey = 'home' | 'today' | 'inbox' | 'habits' | 'mine' | 'folders';

const NAV: { href: Href & string; key: NavKey; icon: LucideIcon; projectsOnly?: boolean }[] = [
  { href: '/', key: 'home', icon: House },
  { href: '/today', key: 'today', icon: Sun },
  { href: '/inbox', key: 'inbox', icon: Inbox },
  { href: '/habits', key: 'habits', icon: Repeat },
  // Só para quem participa de algum projeto (D69)
  { href: '/mine', key: 'mine', icon: UserCheck, projectsOnly: true },
  { href: '/folders', key: 'folders', icon: LayoutGrid },
];

/**
 * Barra lateral em tela larga (docs/mockups/sidebar.html): 256 px, atalhos, Pastas e Projetos como
 * seções separadas e recolhíveis, e no rodapé o nível, os atalhos do jogo e o estado da conexão.
 * Fica fora da pilha de telas, então continua visível dentro das páginas.
 */
export function Sidebar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const tree = useTree();
  const online = useIsOnline();
  const [actions, dialog] = useFolderActions();
  const [open, setOpen] = useState(() => new Set(getOpenFolders()));
  const openPalette = useCommandPalette();

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
    return (
      <View key={folder.id}>
        <TreeRow
          depth={depth}
          href={`/folder/${folder.id}`}
          label={folder.name}
          icon={
            <ItemIcon icon={folder.icon} kind={folder.kind === 'project' ? 'project' : 'folder'} />
          }
          marker={folder.color}
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
                className="min-h-8 flex-row items-center gap-2 rounded hover:bg-wash active:bg-wash"
                style={{ paddingLeft: 28 + (depth + 1) * 12 }}
                onPress={() => actions.newPage(folder.id)}
              >
                <Icon icon={Plus} tone="ink-muted" />
                <Text className="text-sm text-ink-muted">{t('nav.newPage')}</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    );
  }

  function renderPage(page: Page, depth: number) {
    return (
      <TreeRow
        key={page.id}
        depth={depth}
        href={`/page/${page.id}`}
        label={page.name}
        icon={<ItemIcon icon={page.icon} kind={page.view_type as ItemKind} />}
        active={pathname === `/page/${page.id}`}
      />
    );
  }

  const folders = tree.data?.folders ?? [];
  const personal = folders.filter((f) => f.kind !== 'project');
  const projects = folders.filter((f) => f.kind === 'project');
  const inProject = projects.length > 0;

  return (
    <SafeAreaView
      edges={['top', 'left', 'bottom']}
      className="w-64 border-r border-line bg-surface"
      role="navigation"
    >
      <View className="gap-6 px-2 pt-3">
        <View className="flex-row items-center pl-2">
          <Text className="flex-1 font-serif text-lg text-ink">Questlist</Text>
          <ThemeToggle />
        </View>
        <View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('palette.open')}
            className="mb-2 min-h-8 flex-row items-center gap-2 rounded border border-line px-2 hover:bg-wash active:bg-wash"
            onPress={openPalette}
          >
            <Icon icon={Search} tone="ink-muted" />
            <Text className="flex-1 text-sm text-ink-muted">{t('palette.open')}</Text>
            <Kbd>Ctrl K</Kbd>
          </Pressable>
          {NAV.filter((item) => !item.projectsOnly || inProject).map((item) => (
            <NavRow
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={t(`nav.${item.key}`)}
              selected={
                pathname === item.href ||
                (item.href === '/folders' && pathname.startsWith('/folder/'))
              }
            />
          ))}
        </View>
      </View>

      <ScrollView className="mt-6 flex-1" contentContainerClassName="gap-6 px-2 pb-6">
        <View>
          <SectionHeader
            label={t('nav.folders')}
            action={
              <IconButton
                icon={Plus}
                label={t('nav.newFolder')}
                disabled={!online}
                aria-disabled={!online}
                onPress={() => actions.newFolder()}
              />
            }
          />
          {personal.map((folder) => renderFolder(folder, 0))}
          {tree.data && folders.length === 0 && (
            <Pressable
              accessibilityRole="button"
              disabled={!online}
              className="min-h-8 flex-row items-center gap-2 rounded px-2 hover:bg-wash active:bg-wash"
              onPress={() => actions.newFolder()}
            >
              <Icon icon={Plus} tone="ink-muted" />
              <Text className="text-sm text-ink-muted">{t('nav.firstFolder')}</Text>
            </Pressable>
          )}
        </View>
        {inProject && (
          <View>
            <SectionHeader label={t('nav.projects')} />
            {projects.map((folder) => renderFolder(folder, 0))}
          </View>
        )}
      </ScrollView>

      <SidebarFooter online={online} />
      {dialog}
    </SafeAreaView>
  );
}

/** Rodapé: nível e XP (fio de 2 px), atalhos do jogo e da conta, e o ponto de sincronização. */
function SidebarFooter({ online }: { online: boolean }) {
  const { t } = useTranslation();
  const newMenu = useNewMenu();
  const anchor = useRef<View>(null);
  const pathname = usePathname();
  const unread = useUnreadCount();
  const { data: game } = useGameState();
  return (
    <View className="gap-2 border-t border-line px-2 py-2">
      <View ref={anchor} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('newMenu.button')}
          className="min-h-8 flex-row items-center gap-2 rounded px-2 hover:bg-wash active:bg-wash"
          onPress={() => newMenu.open(anchor)}
        >
          <Icon icon={Plus} tone="ink" />
          <Text className="flex-1 text-sm font-semibold text-ink">{t('newMenu.button')}</Text>
          <Kbd>Alt N</Kbd>
        </Pressable>
      </View>
      {game?.enabled && (
        <Link href="/character" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('nav.characterSummary', {
              level: game.level,
              into: game.into_level,
              next: game.for_next,
            })}
            className="gap-1 rounded px-2 py-2 hover:bg-wash active:bg-wash"
          >
            <View className="flex-row justify-between">
              <Text className="font-mono text-xs text-ink">
                {t('nav.level', { level: game.level })}
              </Text>
              <Text className="font-mono text-xs text-ink-muted">
                {t('nav.xp', { into: game.into_level, next: game.for_next })}
              </Text>
            </View>
            <ProgressBar value={game.into_level / game.for_next} label="" />
          </Pressable>
        </Link>
      )}
      <View className="flex-row items-center">
        <FooterLink
          href="/profile"
          icon={User}
          label={t('nav.profile')}
          active={pathname === '/profile'}
        />
        <FooterLink
          href="/notifications"
          icon={Bell}
          label={unread ? t('nav.notificationsUnread', { count: unread }) : t('nav.notifications')}
          active={pathname === '/notifications'}
          badge={unread > 0 ? <Badge count={unread} /> : null}
        />
        <FooterLink
          href="/clan"
          icon={Shield}
          label={t('nav.clan')}
          active={pathname === '/clan'}
        />
        <FooterLink
          href="/shop"
          icon={ShoppingBag}
          label={t('nav.shop')}
          active={pathname === '/shop'}
        />
        <FooterLink
          href="/ajuda"
          icon={CircleHelp}
          label={t('help.link')}
          active={pathname === '/ajuda'}
        />
        <View
          accessibilityLabel={online ? t('nav.online') : t('nav.offline')}
          className="ml-auto mr-2 flex-row items-center"
        >
          <View className={cn('h-2 w-2 rounded-full', online ? 'bg-ok' : 'bg-warn')} />
        </View>
      </View>
    </View>
  );
}

function FooterLink({
  href,
  icon,
  label,
  active,
  badge,
}: {
  href: Href & string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  badge?: ReactNode;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'h-8 w-8 items-center justify-center rounded hover:bg-wash active:bg-wash',
          active && 'bg-wash',
        )}
      >
        <Icon icon={icon} size={20} tone={active ? 'ink' : 'ink-muted'} />
        {badge && <View className="absolute -right-1 -top-1">{badge}</View>}
      </Pressable>
    </Link>
  );
}

function NavRow({
  href,
  icon,
  label,
  selected,
}: {
  href: Href & string;
  icon: LucideIcon;
  label: string;
  selected: boolean;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        aria-current={selected ? 'page' : undefined}
        className={cn(
          'min-h-8 flex-row items-center gap-2 rounded px-2 hover:bg-wash active:bg-wash',
          selected && 'bg-wash',
        )}
      >
        <Icon icon={icon} tone={selected ? 'ink' : 'ink-muted'} />
        <Text className={cn('text-sm text-ink', selected && 'font-semibold')}>{label}</Text>
      </Pressable>
    </Link>
  );
}

function SectionHeader({ label, action }: { label: string; action?: ReactNode }) {
  return (
    <View className="min-h-8 flex-row items-center pl-2">
      <Text className="flex-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </Text>
      {action}
    </View>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <Text className="rounded border border-line px-1 font-mono text-xs text-ink-muted">
      {children}
    </Text>
  );
}

function TreeRow({
  depth,
  href,
  label,
  icon,
  marker,
  active,
  expanded,
  onToggle,
  onMenu,
}: {
  depth: number;
  href: Href & string;
  label: string;
  icon: ReactNode;
  marker?: string | null;
  active: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onMenu?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View
      className={cn('min-h-8 flex-row items-center rounded hover:bg-wash', active && 'bg-wash')}
      style={{ paddingLeft: depth * 12 }}
    >
      {onToggle ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(expanded ? 'nav.collapse' : 'nav.expand', { name: label })}
          aria-expanded={expanded}
          className="h-8 w-7 items-center justify-center rounded"
          onPress={onToggle}
        >
          <Icon icon={expanded ? ChevronDown : ChevronRight} tone="ink-muted" />
        </Pressable>
      ) : (
        <View className="w-7" />
      )}
      <Link href={href} asChild>
        <Pressable
          accessibilityRole="link"
          aria-current={active ? 'page' : undefined}
          className="min-h-8 flex-1 flex-row items-center gap-2"
        >
          {marker && <View className="h-4 w-1 rounded" style={{ backgroundColor: marker }} />}
          {icon}
          <Text
            className={cn('flex-1 text-sm text-ink', active && 'font-semibold')}
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
