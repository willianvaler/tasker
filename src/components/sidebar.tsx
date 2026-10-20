import { Link, router, usePathname, type Href } from 'expo-router';
import {
  Bell,
  CalendarDays,
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
  type LucideIcon,
  User,
  UserCheck,
  Dumbbell,
  Globe,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react-native';
import { Fragment, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand-mark';
import { useCommandPalette } from '@/components/command-palette';
import { useFolderActions } from '@/components/folder-actions';
import { MenuButton } from '@/components/folder-cards';
import { ItemIcon, type ItemKind } from '@/components/item-icon';
import { useNewMenu } from '@/components/new-menu';
import { Badge, useUnreadCount } from '@/components/notifications-bell';
import { NotesList, useNewNote } from '@/components/notes-block';
import { ThemeToggle } from '@/components/theme-toggle';
import { IconButton } from '@/components/ui/button';
import { PendingXp } from '@/components/game-bar';
import { SidebarResizer } from '@/components/sidebar-resizer';
import { SyncDot } from '@/components/sync-dot';
import { Icon } from '@/components/ui/icon';
import { rootFolder } from '@/lib/queries/projects';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { getOpenFolders, getSidebarWidth, setOpenFolders, setSidebarWidth } from '@/lib/prefs';
import { useMyFriends } from '@/lib/queries/friends';
import { useGameState } from '@/lib/queries/game';
import { availableBlocks } from '@/components/sidebar-settings';
import { useProfile, useUiPrefs } from '@/lib/queries/profile';
import { resolveBlocks, type SidebarBlock } from '@/lib/sidebar-blocks';
import { splitRoots, useTree, type Page, type SubFolder } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';
import { PendingShares } from '@/components/received';
import { usePendingShares, useReceivedPages } from '@/lib/queries/shares';

/** Largura a partir da qual as abas viram barra lateral. */
export const WIDE = 768;

export function useIsWide() {
  return useWindowDimensions().width >= WIDE;
}

type NavKey = 'home' | 'today' | 'inbox' | 'habits' | 'calendar' | 'mine' | 'folders';

const NAV: { href: Href & string; key: NavKey; icon: LucideIcon; projectsOnly?: boolean }[] = [
  { href: '/', key: 'home', icon: House },
  { href: '/today', key: 'today', icon: Sun },
  { href: '/inbox', key: 'inbox', icon: Inbox },
  { href: '/habits', key: 'habits', icon: Repeat },
  { href: '/calendario', key: 'calendar', icon: CalendarDays },
  // Só para quem participa de algum projeto
  { href: '/mine', key: 'mine', icon: UserCheck, projectsOnly: true },
  { href: '/folders', key: 'folders', icon: LayoutGrid },
];

/**
 * Barra lateral em tela larga: 256 px, atalhos, Pastas e Projetos como
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
  const [width, setWidth] = useState(getSidebarWidth);
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
                onPress={() =>
                  folder.gym_group ? actions.newGroupWorkout(folder.id) : actions.newPage(folder.id)
                }
              >
                <Icon icon={Plus} tone="ink-muted" />
                {/* Y2 (#10): no projeto, "Nova lista", como na tela do projeto */}
                <Text className="text-sm text-ink-muted">
                  {t(
                    folder.gym_group
                      ? 'gym.newWorkout'
                      : rootFolder(tree.data, folder.id)?.kind === 'project'
                        ? 'project.item.new'
                        : 'nav.newPage',
                  )}
                </Text>
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

  const gymOn = useProfile().data?.gym_enabled === true;
  const sidebarPrefs = useUiPrefs().sidebar;
  const { personal, projects, gym, groups } = splitRoots(tree.data, gymOn);
  // Páginas recebidas (L4): não estão em pasta nenhuma do usuário
  const received = useReceivedPages();
  const pending = usePendingShares();
  const inProject = projects.length > 0;
  const newNote = useNewNote();

  // Blocos da barra lateral, na ordem e com os escondidos do perfil (V6 §15.2)
  const blocks: Record<SidebarBlock, ReactNode> = {
    notes: (
      <>
        {/* W3: anotações acima de Pastas e Projetos */}
        <View>
          <SectionHeader
            label={t('notes.title')}
            action={<IconButton icon={Plus} label={t('notes.new')} onPress={newNote} />}
          />
          <NotesList limit={5} />
        </View>
      </>
    ),
    folders: (
      <>
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
          {tree.data && personal.length + projects.length === 0 && (
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
      </>
    ),
    gym: (
      <>
        {/* V6 §15.1: Academia logo acima de Projetos, com os treinos direto (sem abrir a pasta) */}
        {gymOn && (
          <View>
            <SectionHeader
              label={t('gym.block')}
              action={
                <IconButton
                  icon={Plus}
                  label={t('gym.newWorkout')}
                  disabled={!online}
                  aria-disabled={!online}
                  onPress={actions.newWorkout}
                />
              }
            />
            {gym?.pages.map((page) => renderPage(page, 0))}
            {gym?.children.map((child) => renderFolder(child, 0))}
            {tree.data && !gym?.pages.length && !gym?.children.length && (
              <Pressable
                accessibilityRole="button"
                disabled={!online}
                className="min-h-8 flex-row items-center gap-2 rounded px-2 hover:bg-wash active:bg-wash"
                onPress={actions.newWorkout}
              >
                <Icon icon={Plus} tone="ink-muted" />
                <Text className="text-sm text-ink-muted">{t('gym.firstWorkout')}</Text>
              </Pressable>
            )}
            {/* D186: grupos de treino (compartilhados), com os treinos de cada um */}
            {groups.map((group) => renderFolder(group, 0))}
            <Pressable
              accessibilityRole="button"
              disabled={!online}
              className="min-h-8 flex-row items-center gap-2 rounded px-2 hover:bg-wash active:bg-wash"
              onPress={actions.newGymGroup}
            >
              <Icon icon={Users} tone="ink-muted" />
              <Text className="text-sm text-ink-muted">{t('gym.newGroup')}</Text>
            </Pressable>
            {/* V6 §2: a biblioteca de exercícios */}
            <Pressable
              accessibilityRole="link"
              className="min-h-8 flex-row items-center gap-2 rounded px-2 hover:bg-wash active:bg-wash"
              onPress={() => router.push('/biblioteca')}
            >
              <Icon icon={Dumbbell} tone="ink-muted" />
              <Text className="text-sm text-ink-muted">{t('library.title')}</Text>
            </Pressable>
          </View>
        )}
      </>
    ),
    projects: (
      <>
        {/* W2: Projetos sempre à vista, com o "+" para criar direto daqui */}
        <View>
          <SectionHeader
            label={t('nav.projects')}
            action={
              <IconButton
                icon={Plus}
                label={t('nav.newProjectHere')}
                disabled={!online}
                aria-disabled={!online}
                onPress={() => actions.newProject()}
              />
            }
          />
          {projects.map((folder) => renderFolder(folder, 0))}
          {tree.data && projects.length === 0 && (
            <Pressable
              accessibilityRole="button"
              disabled={!online}
              className="min-h-8 flex-row items-center gap-2 rounded px-2 hover:bg-wash active:bg-wash"
              onPress={() => actions.newProject()}
            >
              <Icon icon={Plus} tone="ink-muted" />
              <Text className="text-sm text-ink-muted">{t('nav.firstProject')}</Text>
            </Pressable>
          )}
        </View>
      </>
    ),
    received: (
      <>
        {((received.data?.length ?? 0) > 0 || (pending.data?.length ?? 0) > 0) && (
          <View>
            <SectionHeader label={t('received.title')} />
            {(received.data ?? []).map((page) => renderPage(page, 0))}
            <PendingShares compact />
          </View>
        )}
      </>
    ),
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'bottom']}
      className="border-r border-line bg-surface"
      style={{ width }}
      role="navigation"
    >
      <SidebarResizer width={width} onChange={setWidth} onCommit={setSidebarWidth} />
      <View className="gap-6 px-2 pt-3">
        <View className="flex-row items-center gap-2 pl-2">
          <BrandMark size={24} />
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('modes.open')}
            className="mb-2 min-h-8 flex-row items-center gap-2 rounded px-2 hover:bg-wash active:bg-wash"
            onPress={() => router.push('/modos')}
          >
            <Icon icon={Zap} tone="ink-muted" />
            <Text className="flex-1 text-sm text-ink">{t('modes.title')}</Text>
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
        {resolveBlocks(sidebarPrefs, availableBlocks(gymOn)).map((block) => (
          <Fragment key={block}>{blocks[block]}</Fragment>
        ))}
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
  // Pedidos de amizade recebidos (V10)
  const friendRequests = (useMyFriends().data ?? []).filter((f) => f.incoming).length;
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
              <PendingXp />
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
          href="/comunidade"
          icon={Globe}
          label={t('nav.community')}
          active={pathname.startsWith('/comunidade')}
        />
        <FooterLink
          href="/amigos"
          icon={UserPlus}
          label={
            friendRequests ? t('nav.friendsPending', { count: friendRequests }) : t('nav.friends')
          }
          active={pathname === '/amigos'}
          badge={friendRequests > 0 ? <Badge count={friendRequests} /> : null}
        />
        <FooterLink
          href="/teams"
          icon={Users}
          label={t('nav.teams')}
          active={pathname === '/teams' || pathname.startsWith('/team/')}
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
        <View className="ml-auto">
          <SyncDot />
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
