import { router } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Grid } from '@/components/ui/grid';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  COMMUNITY_KINDS,
  useCommunityFeed,
  type CommunityCard,
  type CommunityKind,
} from '@/lib/queries/community';
import { useIsOnline } from '@/providers/online';

/** Comunidade (ESCOPO_V10 §4, D233): o que as pessoas publicaram, com busca e filtros. */
export default function CommunityScreen() {
  const { t } = useTranslation();
  const online = useIsOnline();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<CommunityKind | null>(null);
  const [order, setOrder] = useState<'popular' | 'new'>('popular');
  const [mine, setMine] = useState(false);
  const feed = useCommunityFeed({ query, kind, order, mine });

  return (
    <Screen size="wide">
      <ScreenHeader title={t('community.title')} help="comunidade" back />
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 pb-12">
        <Text className="text-sm text-ink-muted">{t('community.intro')}</Text>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={t('community.search')}
          accessibilityLabel={t('community.search')}
        />
        <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
          <Chip
            role="radio"
            label={t('community.all')}
            selected={!kind}
            onPress={() => setKind(null)}
          />
          {COMMUNITY_KINDS.map((k) => (
            <Chip
              key={k}
              role="radio"
              label={t(`community.kind.${k}`)}
              selected={kind === k}
              onPress={() => setKind(kind === k ? null : k)}
            />
          ))}
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Chip
            role="radio"
            label={t('community.popular')}
            selected={order === 'popular'}
            onPress={() => setOrder('popular')}
          />
          <Chip
            role="radio"
            label={t('community.newest')}
            selected={order === 'new'}
            onPress={() => setOrder('new')}
          />
          <Chip
            role="checkbox"
            label={t('community.mine')}
            selected={mine}
            onPress={() => setMine(!mine)}
          />
        </View>
        {!online && <Text className="text-sm text-warn">{t('community.offline')}</Text>}
        {feed.error && (
          <Text className="text-sm text-danger">
            {t('common.loadError', { message: feed.error.message })}
          </Text>
        )}
        {!feed.isPending && (feed.data ?? []).length === 0 ? (
          <EmptyState
            title={t(mine ? 'community.emptyMine' : 'community.empty')}
            hint={t('community.emptyHint')}
          />
        ) : (
          <Grid breakpoints={[700, 1200]}>
            {(feed.data ?? []).map((card) => (
              <PostCard key={card.id} card={card} />
            ))}
          </Grid>
        )}
      </ScreenScroll>
    </Screen>
  );
}

function PostCard({ card }: { card: CommunityCard }) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('community.open', { title: card.title })}
      onPress={() => router.push({ pathname: '/comunidade/[id]', params: { id: card.id } })}
      className="h-full gap-2 rounded-lg border border-line bg-surface p-4 hover:bg-wash"
    >
      <View className="flex-row items-center gap-2">
        {card.icon ? <Text className="text-lg">{card.icon}</Text> : null}
        <Text className="flex-1 text-base font-semibold text-ink" numberOfLines={2}>
          {card.title}
        </Text>
      </View>
      <Text className="text-xs text-ink-muted">
        {`${t(`community.kind.${card.kind}`)} · @${card.author_username}`}
      </Text>
      {card.description ? (
        <Text className="text-sm text-ink" numberOfLines={3}>
          {card.description}
        </Text>
      ) : null}
      <View className="mt-auto flex-row items-center gap-3">
        <Text className="font-mono text-xs text-ink-muted">
          {t('community.size', { pages: card.pages, items: card.items })}
        </Text>
        <Text className="font-mono text-xs text-ink-muted">
          {t('community.uses', { count: card.uses })}
        </Text>
        <View className="flex-row items-center gap-1">
          <Icon icon={Heart} size={16} tone={card.liked ? 'accent' : 'ink-muted'} />
          <Text className="font-mono text-xs text-ink-muted">{card.likes}</Text>
        </View>
      </View>
    </Pressable>
  );
}
