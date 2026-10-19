import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import {
  achievementText,
  CATEGORIES,
  filterAchievements,
  nextInSeries,
  RARITIES,
  rarityRank,
  type AchievementFilter,
  type AchievementItem,
  type Rarity,
} from '@/lib/achievements';
import { cn } from '@/lib/cn';
import { useMyAchievements } from '@/lib/queries/game';
import { useIsOnline } from '@/providers/online';

// Conquistas (P3, D180): todas as 68 com raridade, categoria, % de jogadores e o progresso até a
// próxima de cada faixa. Secretas aparecem só com uma dica até serem conquistadas.

// Cor própria por raridade (tokens do tema, D180); o nome escrito e os pontos (1 a 5) dizem o
// mesmo sem depender da cor
const RARITY_TEXT: Record<Rarity, string> = {
  common: 'text-rarity-common',
  uncommon: 'text-rarity-uncommon',
  rare: 'text-rarity-rare',
  epic: 'text-rarity-epic',
  legendary: 'text-rarity-legendary',
};
const RARITY_BORDER: Record<Rarity, string> = {
  common: 'border-rarity-common',
  uncommon: 'border-rarity-uncommon',
  rare: 'border-rarity-rare',
  epic: 'border-rarity-epic',
  legendary: 'border-rarity-legendary',
};

export default function AchievementsScreen() {
  const { t, i18n } = useTranslation();
  const online = useIsOnline();
  // No celular, 3 próximas (6 no computador)
  const wide = useWindowDimensions().width >= 768;
  const query = useMyAchievements();
  const [filter, setFilter] = useState<AchievementFilter>({});
  const data = query.data;
  const items = data?.items ?? [];
  const done = items.filter((i) => i.unlocked_at).length;
  const next = data ? [...nextInSeries(items, data.progress).values()] : [];
  const shown = filterAchievements(items, filter);
  const toggle = <K extends keyof AchievementFilter>(key: K, value: AchievementFilter[K]) =>
    setFilter((f) => ({ ...f, [key]: f[key] === value ? null : value }));

  return (
    <Screen size="wide">
      <ScreenHeader
        title={t('achievements.title')}
        eyebrow={data ? t('achievements.count', { done, total: items.length }) : undefined}
        back
        help="xp-sequencia-bosses"
      />
      <ScreenScroll contentContainerClassName="gap-6 pb-12">
        {!online && !data && <Text className="text-sm text-warn">{t('achievements.offline')}</Text>}

        {next.length > 0 && (
          <View className="gap-3">
            <SectionLabel title={t('achievements.next')} />
            <View className="flex-row flex-wrap gap-x-6 gap-y-3">
              {next
                .sort((a, b) => b.ratio - a.ratio)
                .slice(0, wide ? 6 : 3)
                .map((n) => {
                  const { name } = achievementText({ key: n.key });
                  const label = t('achievements.nextItem', {
                    name,
                    value: n.value.toLocaleString(i18n.language),
                    goal: n.goal.toLocaleString(i18n.language),
                  });
                  return (
                    <View key={n.key} className="w-full gap-1 md:w-[calc(50%-12px)]">
                      <Text className="text-sm text-ink">{label}</Text>
                      <ProgressBar value={n.ratio} label={label} />
                    </View>
                  );
                })}
            </View>
          </View>
        )}

        <View className="gap-2">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2"
            accessibilityRole="radiogroup"
          >
            {(['all', 'unlocked', 'locked'] as const).map((state) => (
              <Chip
                key={state}
                role="radio"
                label={t(`achievements.${state}`)}
                selected={(filter.state ?? 'all') === state}
                onPress={() => setFilter((f) => ({ ...f, state: state === 'all' ? null : state }))}
              />
            ))}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2"
            accessibilityLabel={t('achievements.filterRarity')}
          >
            {RARITIES.map((rarity) => (
              <Chip
                key={rarity}
                label={t(`achievements.rarity.${rarity}`)}
                selected={filter.rarity === rarity}
                onPress={() => toggle('rarity', rarity)}
              />
            ))}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2"
            accessibilityLabel={t('achievements.filterCategory')}
          >
            {CATEGORIES.map((category) => (
              <Chip
                key={category}
                label={t(`achievements.category.${category}`)}
                selected={filter.category === category}
                onPress={() => toggle('category', category)}
              />
            ))}
          </ScrollView>
        </View>

        {data && shown.length === 0 && <EmptyState title={t('achievements.empty')} />}
        <View className="flex-row flex-wrap" accessibilityRole="list">
          {shown.map((item) => (
            <AchievementRow key={item.key} item={item} />
          ))}
        </View>
      </ScreenScroll>
    </Screen>
  );
}

function AchievementRow({ item }: { item: AchievementItem }) {
  const { t, i18n } = useTranslation();
  const unlocked = !!item.unlocked_at;
  const hidden = item.secret && !unlocked;
  const text = achievementText({ key: item.key });
  const name = hidden ? t('achievements.secretName') : text.name;
  const description = hidden
    ? t(`achievements.hints.${item.key}` as 'achievements.title')
    : text.description;
  const rarity = t(`achievements.rarity.${item.rarity}`);
  const pct =
    item.pct == null || item.pct === 0
      ? t('achievements.pctNone')
      : t('achievements.pct', { pct: item.pct.toLocaleString(i18n.language) });
  const date = item.unlocked_at
    ? t('achievements.unlockedOn', {
        date: new Date(item.unlocked_at).toLocaleDateString(i18n.language),
      })
    : null;
  return (
    <View
      role="listitem"
      accessibilityLabel={[name, description, t('achievements.rarityLabel', { rarity }), pct, date]
        .filter(Boolean)
        .join('. ')}
      className="min-h-16 w-full flex-row items-center gap-3 border-b border-line py-3 md:w-1/2 md:pr-6"
    >
      <View
        className={cn(
          'h-10 w-10 items-center justify-center rounded border',
          unlocked ? RARITY_BORDER[item.rarity] : 'border-line',
        )}
      >
        {/* Ícone da conquista: conteúdo do jogo; bloqueada fica apagada, secreta com cadeado */}
        <Text className={cn('text-lg', !unlocked && 'opacity-30')}>
          {hidden ? '🔒' : (item.icon ?? '·')}
        </Text>
      </View>
      <View className="flex-1 gap-1">
        <Text className={cn('text-sm', unlocked ? 'text-ink' : 'text-ink-muted')}>{name}</Text>
        <Text className="text-xs text-ink-muted">{description}</Text>
        <Text className="font-mono text-xs">
          <Text className={RARITY_TEXT[item.rarity]}>
            {'●'.repeat(rarityRank(item.rarity) + 1)}
            {'○'.repeat(RARITIES.length - rarityRank(item.rarity) - 1)} {rarity}
          </Text>
          <Text className="text-ink-muted">
            {' · '}
            {pct}
            {date ? ` · ${date}` : ''}
          </Text>
        </Text>
      </View>
    </View>
  );
}
