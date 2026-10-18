import { useQueryClient } from '@tanstack/react-query';
import { router, usePathname } from 'expo-router';
import {
  Backpack,
  CalendarDays,
  CheckSquare,
  CircleHelp,
  Folder,
  House,
  Inbox,
  LayoutGrid,
  PanelLeft,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  Send,
  Shield,
  ShoppingBag,
  SlidersHorizontal,
  SunMoon,
  Swords,
  Timer,
  Trash2,
  Trophy,
  User,
  Users,
  Watch,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { useFolderActions } from '@/components/folder-actions';
import { ItemIcon, type ItemKind } from '@/components/item-icon';
import { Icon } from '@/components/ui/icon';
import { Text, textClass } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import type { Task } from '@/lib/queries/tasks';
import { usePomodoro, useStartTimer } from '@/components/timer-bar';
import { useTree } from '@/lib/queries/tree';
import { DURATION, useColors } from '@/lib/tokens';
import { toggleSidebar } from '@/lib/ui-state';
import { useShortcut } from '@/lib/use-shortcut';
import { useThemePreference } from '@/providers/theme';

type Command = {
  id: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
  group: 0 | 1 | 2;
};

const PaletteContext = createContext<() => void>(() => {});

export function useCommandPalette() {
  return useContext(PaletteContext);
}

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Os diálogos (nova pasta, novo projeto) ficam aqui: a paleta fecha antes de abri-los
  const [actions, dialog] = useFolderActions();
  useShortcut('palette.open', () => setOpen(true));
  return (
    <PaletteContext.Provider value={() => setOpen(true)}>
      {children}
      {open && <Palette actions={actions} onClose={() => setOpen(false)} />}
      {dialog}
    </PaletteContext.Provider>
  );
}

function Palette({
  actions,
  onClose,
}: {
  actions: ReturnType<typeof useFolderActions>[0];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const reduced = useReducedMotion();
  const tree = useTree();
  const queryClient = useQueryClient();
  const { colorScheme } = useColorScheme();
  const { setPreference } = useThemePreference();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);

  const go = (href: Parameters<typeof router.navigate>[0]) => () => router.navigate(href);
  const startTimer = useStartTimer();
  // Página aberta: "Enviar esta página" (L3)
  const openPage = /^\/page\/([^/?]+)/.exec(usePathname() ?? '')?.[1];
  const pomodoro = usePomodoro();
  const icon = (glyph: LucideIcon) => <Icon icon={glyph} tone="ink-muted" />;

  const commands: Command[] = [
    {
      id: 'new-task',
      label: t('palette.newTask'),
      hint: 'N',
      icon: icon(Plus),
      group: 0,
      run: () => router.push('/capture'),
    },
    {
      id: 'new-advanced',
      label: t('newMenu.advanced'),
      hint: 'Alt ⇧ N',
      icon: icon(SlidersHorizontal),
      group: 0,
      run: () => router.push('/task/new'),
    },
    {
      id: 'new-page',
      label: t('folder.newPage'),
      icon: icon(Plus),
      group: 0,
      run: () => {
        const folder = tree.data?.folders[0];
        if (folder) actions.newPage(folder.id);
        else actions.newFolder();
      },
    },
    {
      id: 'new-folder',
      label: t('folder.newFolder'),
      icon: icon(Plus),
      group: 0,
      run: () => actions.newFolder(),
    },
    {
      id: 'new-project',
      label: t('folder.newProject'),
      icon: icon(Plus),
      group: 0,
      run: () => actions.newProject(),
    },
    {
      id: 'theme',
      label: t('palette.theme'),
      icon: icon(SunMoon),
      group: 0,
      run: () => setPreference(colorScheme === 'dark' ? 'light' : 'dark'),
    },
    {
      id: 'sidebar',
      label: t('palette.sidebar'),
      hint: 'Ctrl B',
      icon: icon(PanelLeft),
      group: 0,
      run: toggleSidebar,
    },
    ...(openPage
      ? [
          {
            id: 'send-page',
            label: t('send.paletteSend'),
            icon: icon(Send),
            group: 0 as const,
            run: () => router.push({ pathname: '/page/[id]', params: { id: openPage, send: '1' } }),
          },
        ]
      : []),
    {
      id: 'modes',
      label: t('modes.open'),
      icon: icon(Zap),
      group: 0,
      run: go('/modos'),
    },
    {
      id: 'pomodoro-settings',
      label: t('pomodoro.settingsLabel'),
      icon: icon(Timer),
      group: 0,
      run: go('/pomodoro'),
    },
    {
      id: 'pomodoro',
      label: t('pomodoro.start'),
      icon: icon(Timer),
      group: 0,
      run: () => void pomodoro.start(),
    },
    ...[1, 5].map((minutes): Command => ({
      id: `timer-${minutes}`,
      label: t('palette.timer', { minutes }),
      icon: icon(Timer),
      group: 0,
      run: () => void startTimer({ kind: 'countdown', seconds: minutes * 60 }),
    })),
    {
      id: 'stopwatch',
      label: t('palette.stopwatch'),
      icon: icon(Watch),
      group: 0,
      run: () => void startTimer({ kind: 'stopwatch' }),
    },
    {
      id: 'help',
      label: t('palette.help'),
      hint: '?',
      icon: icon(CircleHelp),
      group: 0,
      run: go('/ajuda'),
    },
    { id: 'go-home', label: t('nav.home'), icon: icon(House), group: 0, run: go('/') },
    {
      id: 'go-today',
      label: t('nav.today'),
      hint: 'G H',
      icon: icon(CheckSquare),
      group: 0,
      run: go('/today'),
    },
    {
      id: 'go-inbox',
      label: t('nav.inbox'),
      hint: 'G I',
      icon: icon(Inbox),
      group: 0,
      run: go('/inbox'),
    },
    { id: 'go-habits', label: t('nav.habits'), icon: icon(Repeat), group: 0, run: go('/habits') },
    {
      id: 'go-calendar',
      label: t('nav.calendar'),
      hint: 'G C',
      icon: icon(CalendarDays),
      group: 0,
      run: go('/calendario'),
    },
    {
      id: 'go-mine',
      label: t('nav.mine'),
      hint: 'G M',
      icon: icon(Users),
      group: 0,
      run: go('/mine'),
    },
    {
      id: 'go-folders',
      label: t('nav.folders'),
      icon: icon(LayoutGrid),
      group: 0,
      run: go('/folders'),
    },
    { id: 'go-profile', label: t('nav.profile'), icon: icon(User), group: 0, run: go('/profile') },
    {
      id: 'go-character',
      label: t('nav.character'),
      icon: icon(Swords),
      group: 0,
      run: go('/character'),
    },
    { id: 'go-shop', label: t('nav.shop'), icon: icon(ShoppingBag), group: 0, run: go('/shop') },
    {
      id: 'go-inventory',
      label: t('inventory.title'),
      icon: icon(Backpack),
      group: 0,
      run: go('/inventario'),
    },
    {
      id: 'go-achievements',
      label: t('achievements.title'),
      icon: icon(Trophy),
      group: 0,
      run: go('/conquistas'),
    },
    { id: 'go-teams', label: t('nav.teams'), icon: icon(Users), group: 0, run: go('/teams') },
    { id: 'go-clan', label: t('nav.clan'), icon: icon(Shield), group: 0, run: go('/clan') },
    { id: 'go-trash', label: t('trash.title'), icon: icon(Trash2), group: 0, run: go('/lixeira') },
    { id: 'go-sync', label: t('sync.title'), icon: icon(RefreshCw), group: 0, run: go('/sync') },
    ...(tree.data?.folders ?? []).flatMap((root) => [
      {
        id: `folder-${root.id}`,
        label: root.name,
        hint: root.kind === 'project' ? t('folder.project') : undefined,
        icon: <ItemIcon icon={root.icon} kind={root.kind === 'project' ? 'project' : 'folder'} />,
        group: 1 as const,
        run: go({ pathname: '/folder/[id]', params: { id: root.id } }),
      },
      ...[root, ...root.children].flatMap((folder) =>
        folder.pages.map((page) => ({
          id: `page-${page.id}`,
          label: page.name,
          hint: folder.id === root.id ? root.name : `${root.name} / ${folder.name}`,
          icon: <ItemIcon icon={page.icon} kind={page.view_type as ItemKind} />,
          group: 1 as const,
          run: go({ pathname: '/page/[id]', params: { id: page.id } }),
        })),
      ),
      ...root.children.map((child) => ({
        id: `folder-${child.id}`,
        label: child.name,
        hint: root.name,
        icon: <Icon icon={Folder} tone="ink-muted" />,
        group: 1 as const,
        run: go({ pathname: '/folder/[id]', params: { id: child.id } }),
      })),
    ]),
  ];

  // Tarefas: só as que já estão no cache
  const q = fold(query.trim());
  const tasks = new Map<string, Task>();
  if (q.length >= 2)
    for (const [, data] of queryClient.getQueriesData<Task[]>({ queryKey: ['tasks'] }))
      for (const task of Array.isArray(data) ? data : [])
        if (fold(task.title).includes(q)) tasks.set(task.id, task);
  const taskCommands: Command[] = [...tasks.values()].slice(0, 8).map((task) => ({
    id: `task-${task.id}`,
    label: task.title,
    icon: <Icon icon={CheckSquare} tone="ink-muted" />,
    group: 2,
    run: () => router.push({ pathname: '/task/[id]', params: { id: task.id } }),
  }));

  const results = (
    q
      ? commands
          .map((c) => ({ c, at: fold(c.label).indexOf(q) }))
          .filter(({ at, c }) => at >= 0 || (c.hint && fold(c.hint).includes(q)))
          // Começar com o texto vale mais do que conter
          .sort((a, b) => a.c.group - b.c.group || Number(a.at !== 0) - Number(b.at !== 0))
          .map(({ c }) => c)
      : commands.filter((c) => c.group === 0)
  )
    .concat(taskCommands)
    .slice(0, 30);
  const selected = Math.min(index, Math.max(0, results.length - 1));

  function run(command: Command | undefined) {
    if (!command) return;
    onClose();
    command.run();
  }

  return (
    <Modal transparent animationType="none" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel={t('common.close')}
        className="absolute inset-0 bg-scrim/40"
        onPress={onClose}
      />
      <Animated.View
        entering={reduced ? undefined : FadeIn.duration(DURATION.fast)}
        style={{
          width: '100%',
          maxWidth: 600,
          alignSelf: 'center',
          marginTop: '12%',
          paddingHorizontal: 16,
        }}
      >
        <View
          accessibilityRole="search"
          className="overflow-hidden rounded-lg border border-line bg-surface"
        >
          <View className="flex-row items-center gap-3 border-b border-line px-4">
            <Icon icon={Search} tone="ink-muted" />
            <TextInput
              autoFocus
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                setIndex(0);
              }}
              placeholder={t('palette.placeholder')}
              placeholderTextColor={colors['ink-muted']}
              accessibilityLabel={t('palette.label')}
              onKeyPress={(event) => {
                const key = event.nativeEvent.key;
                if (key === 'ArrowDown') setIndex(Math.min(selected + 1, results.length - 1));
                else if (key === 'ArrowUp') setIndex(Math.max(selected - 1, 0));
                else if (key === 'Enter') run(results[selected]);
                else if (key === 'Escape') onClose();
                else return;
                event.preventDefault();
              }}
              className={textClass('min-h-12 flex-1 text-base text-ink')}
            />
          </View>
          <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
            {results.map((command, i) => (
              <Pressable
                key={command.id}
                accessibilityRole="button"
                aria-selected={i === selected}
                onPress={() => run(command)}
                className={cn(
                  'min-h-11 flex-row items-center gap-3 px-4 md:min-h-9',
                  i === selected ? 'bg-wash' : 'hover:bg-wash',
                )}
              >
                {command.icon}
                <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
                  {command.label}
                </Text>
                {command.hint && (
                  <Text className="font-mono text-xs text-ink-muted" numberOfLines={1}>
                    {command.hint}
                  </Text>
                )}
              </Pressable>
            ))}
            {results.length === 0 && (
              <Text className="px-4 py-4 text-sm text-ink-muted">{t('palette.none')}</Text>
            )}
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
}
