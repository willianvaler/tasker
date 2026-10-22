import type { BottomTabBarProps } from 'expo-router/js-tabs';
import {
  CalendarRange,
  Dumbbell,
  House,
  Inbox,
  LayoutGrid,
  Plus,
  Repeat,
  Swords,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useNewMenu } from '@/components/new-menu';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { useGameLevel } from '@/lib/queries/game';
import { useProfile, useUiPrefs, useUpdateUiPrefs } from '@/lib/queries/profile';
import { availableSlots, barRoutes, resolveSlots, type TabSlot } from '@/lib/tab-slots';
import { useIsOnline } from '@/providers/online';

const ICON: Record<'index' | 'mais' | TabSlot, LucideIcon> = {
  index: House,
  planejar: CalendarRange,
  inbox: Inbox,
  habits: Repeat,
  folders: LayoutGrid,
  treino: Dumbbell,
  jogo: Swords,
  pessoas: Users,
  mais: User,
};

/** As duas posições escolhidas da barra (Configurações → Navegação). */
export function useTabSlots() {
  const saved = useUiPrefs().tabs;
  const gym = useProfile().data?.gym_enabled === true;
  const game = useGameLevel();
  return resolveSlots(saved, { gym, game });
}

/** Nome de cada destino da barra (o mesmo no seletor das Configurações). */
export function useTabLabel() {
  const { t } = useTranslation();
  return (route: 'index' | 'mais' | TabSlot) =>
    ({
      index: t('nav.today'),
      planejar: t('nav.plan'),
      inbox: t('nav.inboxShort'),
      habits: t('nav.habits'),
      folders: t('nav.folders'),
      treino: t('nav.workout'),
      jogo: t('nav.game'),
      pessoas: t('nav.people'),
      mais: t('nav.more'),
    })[route];
}

/**
 * Barra de baixo do celular (D258): Hoje · posição 2 · + · posição 4 · Mais. O "+" abre o menu
 * Novo e mora na barra (o botão flutuante cobria o aviso de Desfazer, a barra do descanso e links).
 * Tela fora da barra (ex.: Hábitos aberto pelo Mais) deixa o Mais aceso.
 */
export function QuestTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { t } = useTranslation();
  const newMenu = useNewMenu();
  const plus = useRef<View>(null);
  const slots = useTabSlots();
  const label = useTabLabel();
  const routes = barRoutes(slots);
  const current = state.routes[state.index]?.name;
  const active = (routes as readonly string[]).includes(current) ? current : 'mais';

  const item = (name: (typeof routes)[number]) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return null;
    const focused = active === name;
    return (
      <Pressable
        key={name}
        role="tab"
        aria-selected={focused}
        accessibilityLabel={name === 'inbox' ? t('nav.inbox') : label(name)}
        className="flex-1 items-center justify-center gap-1"
        onPress={() => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!event.defaultPrevented) navigation.navigate(route.name, route.params);
        }}
      >
        <Icon icon={ICON[name]} size={20} tone={focused ? 'ink' : 'ink-muted'} />
        <Text className={cn('text-xs', focused ? 'text-ink' : 'text-ink-muted')} numberOfLines={1}>
          {label(name)}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      className="flex-row items-stretch border-t border-line bg-surface"
      style={{ height: 64 + insets.bottom, paddingBottom: insets.bottom }}
    >
      {item(routes[0])}
      {item(routes[1])}
      <View className="flex-1 items-center justify-center">
        <View ref={plus} collapsable={false}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('newMenu.button')}
            className="h-11 w-11 items-center justify-center rounded bg-accent active:opacity-80"
            onPress={() => newMenu.open(plus)}
          >
            <Icon icon={Plus} size={24} tone="on-accent" />
          </Pressable>
        </View>
      </View>
      {item(routes[2])}
      {item(routes[3])}
    </View>
  );
}

/** Configurações → Navegação: as duas posições do meio da barra de baixo (D258). */
export function TabBarSettings() {
  const { t } = useTranslation();
  const online = useIsOnline();
  const update = useUpdateUiPrefs();
  const slots = useTabSlots();
  const label = useTabLabel();
  const gym = useProfile().data?.gym_enabled === true;
  const game = useGameLevel();
  const options = availableSlots({ gym, game });
  const pick = (position: 0 | 1, slot: TabSlot) => {
    const next: [TabSlot, TabSlot] = [...slots];
    const other = position === 0 ? 1 : 0;
    // Escolher a que está na outra posição troca as duas de lugar
    if (next[other] === slot) next[other] = next[position];
    next[position] = slot;
    update.mutate({ tabs: next });
  };
  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text className="text-sm font-semibold text-ink">{t('settings.bottomBar')}</Text>
        <Text className="text-sm text-ink-muted">{t('settings.bottomBarHint')}</Text>
      </View>
      {([0, 1] as const).map((position) => (
        <View key={position} className="gap-2">
          <Text className="text-sm text-ink">
            {t(position === 0 ? 'settings.slotLeft' : 'settings.slotRight')}
          </Text>
          <View
            className="flex-row flex-wrap gap-2"
            accessibilityRole="radiogroup"
            accessibilityLabel={t(position === 0 ? 'settings.slotLeft' : 'settings.slotRight')}
          >
            {options.map((slot) => (
              <Chip
                key={slot}
                role="radio"
                label={label(slot)}
                selected={slots[position] === slot}
                disabled={!online || update.isPending}
                onPress={() => pick(position, slot)}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
