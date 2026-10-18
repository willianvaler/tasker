import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Avatar } from '@/components/character';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Grid } from '@/components/ui/grid';
import { Text } from '@/components/ui/text';
import { RARITY, SLOTS, type Rarity, type Slot } from '@/lib/character';
import { cn } from '@/lib/cn';
import { useEquipItem, useGameState, useItems, useMyItems } from '@/lib/queries/game';
import { useIsOnline } from '@/providers/online';

// Inventário (Q1, D181): o que a pessoa tem, com filtro por espaço, raridade e origem. A loja é o
// lugar de comprar; aqui é o de ver e equipar.

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
type Origin = 'shop' | 'drop';

export default function InventoryScreen() {
  const { t, i18n } = useTranslation();
  const { data: game } = useGameState();
  const catalog = useItems();
  const mine = useMyItems();
  const equip = useEquipItem();
  const online = useIsOnline();
  const [slot, setSlot] = useState<Slot | null>(null);
  const [rarity, setRarity] = useState<Rarity | null>(null);
  const [origin, setOrigin] = useState<Origin | null>(null);

  const byKey = new Map((catalog.data ?? []).map((item) => [item.key, item]));
  const owned = (mine.data ?? []).flatMap((row) => {
    const item = byKey.get(row.item_key);
    return item ? [{ item, source: row.source, acquired_at: row.acquired_at }] : [];
  });
  const isEquipped = (key: string, s: Slot) => game?.equipped[s] === key;
  const shown = owned
    .filter(
      ({ item, source }) =>
        (!slot || item.slot === slot) &&
        (!rarity || item.rarity === rarity) &&
        (!origin || (origin === 'drop' ? source === 'drop' : source !== 'drop')),
    )
    // Equipados primeiro, depois do mais raro para o mais comum
    .sort(
      (a, b) =>
        Number(isEquipped(b.item.key, b.item.slot)) - Number(isEquipped(a.item.key, a.item.slot)) ||
        RARITIES.indexOf(b.item.rarity) - RARITIES.indexOf(a.item.rarity),
    );
  const loaded = !!mine.data && !!catalog.data;

  return (
    <Screen size="wide">
      <ScreenHeader
        title={t('inventory.title')}
        eyebrow={
          loaded
            ? t('inventory.count', { count: owned.length, total: catalog.data?.length ?? 0 })
            : undefined
        }
        back
      />
      <ScrollView contentContainerClassName="gap-4 pb-12">
        <View className="flex-row items-center gap-4">
          {game && <Avatar game={game} size="md" />}
          <Text className="max-w-[640px] flex-1 text-sm text-ink-muted">{t('inventory.hint')}</Text>
        </View>

        <View className="gap-2">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2"
            accessibilityRole="radiogroup"
          >
            <Chip
              role="radio"
              label={t('inventory.all')}
              selected={!slot}
              onPress={() => setSlot(null)}
            />
            {SLOTS.map((s) => (
              <Chip
                key={s.key}
                role="radio"
                label={s.label}
                selected={slot === s.key}
                onPress={() => setSlot(s.key)}
              />
            ))}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2"
          >
            {RARITIES.map((r) => (
              <Chip
                key={r}
                label={RARITY[r].label}
                selected={rarity === r}
                onPress={() => setRarity((current) => (current === r ? null : r))}
              />
            ))}
            {(['shop', 'drop'] as const).map((o) => (
              <Chip
                key={o}
                label={t(o === 'shop' ? 'inventory.fromShop' : 'inventory.fromBoss')}
                selected={origin === o}
                onPress={() => setOrigin((current) => (current === o ? null : o))}
              />
            ))}
          </ScrollView>
        </View>

        {loaded && owned.length === 0 && (
          <View className="items-start gap-2">
            <EmptyState title={t('inventory.empty')} />
            <Button label={t('inventory.goShop')} onPress={() => router.push('/shop')} />
          </View>
        )}

        <Grid breakpoints={[360, 640, 900, 1150]}>
          {shown.map(({ item, source, acquired_at }) => {
            const equipped = isEquipped(item.key, item.slot);
            const slotLabel = SLOTS.find((s) => s.key === item.slot)?.label ?? '';
            const date = new Date(acquired_at).toLocaleDateString(i18n.language);
            return (
              <View
                key={item.key}
                accessibilityLabel={t('inventory.itemLabel', {
                  name: item.name,
                  slot: slotLabel,
                  rarity: RARITY[item.rarity].label,
                })}
                className={cn(
                  'flex-1 items-center justify-between gap-2 rounded-lg border bg-surface p-3',
                  equipped ? 'border-accent' : RARITY[item.rarity].border,
                )}
              >
                {/* Ícone do item: conteúdo do jogo, como o personagem */}
                <Text className="text-xl">{item.icon}</Text>
                <Text className="text-center text-sm font-semibold text-ink" numberOfLines={2}>
                  {item.name}
                </Text>
                <Text className="text-center font-mono text-xs">
                  <Text className={RARITY[item.rarity].text}>{RARITY[item.rarity].label}</Text>
                  <Text className="text-ink-muted"> · {slotLabel}</Text>
                </Text>
                <Text className="text-center text-xs text-ink-muted">
                  {t(source === 'drop' ? 'inventory.dropOn' : 'inventory.shopOn', { date })}
                </Text>
                <Button
                  variant={equipped ? 'primary' : 'ghost'}
                  icon={equipped ? Check : undefined}
                  className="mt-1 self-stretch"
                  label={t(equipped ? 'inventory.equipped' : 'inventory.equip')}
                  accessibilityLabel={`${t(equipped ? 'inventory.equipped' : 'inventory.equip')}: ${item.name}`}
                  disabled={!online}
                  onPress={() =>
                    equip.mutate({ slot: item.slot, item: equipped ? null : item.key })
                  }
                />
              </View>
            );
          })}
        </Grid>
      </ScrollView>
    </Screen>
  );
}
