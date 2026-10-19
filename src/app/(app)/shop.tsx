import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Avatar } from '@/components/character';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { Grid } from '@/components/ui/grid';
import { Text } from '@/components/ui/text';
import { achievementText } from '@/lib/achievements';
import { RARITY, SLOTS, type Slot } from '@/lib/character';
import { cn } from '@/lib/cn';
import { useBuyItem, useEquipItem, useGameState, useItems, type Item } from '@/lib/queries/game';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

// Loja: só visual. Itens comprados com ouro; os raros de verdade só caem de boss.
export default function ShopScreen() {
  const { t } = useTranslation();
  const { data: game } = useGameState();
  const items = useItems();
  const buy = useBuyItem();
  const equip = useEquipItem();
  const online = useIsOnline();
  const toast = useToast();
  const [slot, setSlot] = useState<Slot | null>(null);
  const [confirm, setConfirm, closeConfirm] = useDialog<Item>();

  const list = (items.data ?? []).filter((i) => !slot || i.slot === slot);
  const owned = new Set(game?.inventory ?? []);
  const gold = game?.gold ?? 0;

  return (
    <Screen size="wide">
      <ScreenHeader
        title={t('shop.title')}
        back
        right={
          <Text
            className="font-mono text-sm text-ink"
            accessibilityLabel={t('shop.gold', { gold })}
          >
            {t('shop.goldShort', { gold })}
          </Text>
        }
      />
      <ScreenScroll contentContainerClassName="gap-4 pb-12">
        <View className="flex-row items-center gap-4">
          {game && <Avatar game={game} size="md" />}
          <Text className="max-w-[640px] flex-1 text-sm text-ink-muted">{t('shop.hint')}</Text>
        </View>
        <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
          <Chip role="radio" label={t('shop.all')} selected={!slot} onPress={() => setSlot(null)} />
          {SLOTS.map((s) => (
            <Chip
              key={s.key}
              role="radio"
              label={s.label}
              selected={slot === s.key}
              onPress={() => setSlot(s.key)}
            />
          ))}
        </View>

        <Grid breakpoints={[360, 640, 900, 1150]}>
          {list.map((item) => {
            const mine = owned.has(item.key);
            const equipped = game?.equipped[item.slot] === item.key;
            const rarity = RARITY[item.rarity];
            return (
              <View
                key={item.key}
                className={cn(
                  'flex-1 items-center justify-between gap-2 rounded-lg border bg-surface p-3',
                  rarity.border,
                  !mine && item.price === null && 'opacity-60',
                )}
              >
                {/* Ícone do item: conteúdo do jogo, como o personagem */}
                <Text className="text-xl">{item.icon}</Text>
                <Text className="text-center text-sm font-semibold text-ink" numberOfLines={2}>
                  {item.name}
                </Text>
                <Text className={cn('font-mono text-xs', rarity.text)}>{rarity.label}</Text>
                {mine ? (
                  <Button
                    variant={equipped ? 'primary' : 'ghost'}
                    icon={equipped ? Check : undefined}
                    className="mt-1 self-stretch"
                    label={t(equipped ? 'shop.equipped' : 'shop.equip')}
                    disabled={!online}
                    onPress={() =>
                      equip.mutate({ slot: item.slot, item: equipped ? null : item.key })
                    }
                  />
                ) : item.price === null ? (
                  <Text className="mt-1 min-h-11 text-center font-mono text-xs text-ink-muted md:min-h-8">
                    {t('shop.bossOnly')}
                  </Text>
                ) : (
                  <Button
                    variant="ghost"
                    className="mt-1 self-stretch"
                    label={t('shop.goldShort', { gold: item.price })}
                    accessibilityLabel={t('shop.buyLabel', { name: item.name, price: item.price })}
                    disabled={!online || gold < item.price}
                    onPress={() => setConfirm(item)}
                  />
                )}
              </View>
            );
          })}
        </Grid>
        {items.error && (
          <Text className="text-sm text-danger">
            {t('shop.loadError', { message: items.error.message })}
          </Text>
        )}
      </ScreenScroll>

      {confirm && (
        <ConfirmDialog
          title={t('shop.buyTitle', { name: confirm.name })}
          message={t('shop.buyMessage', {
            price: confirm.price,
            left: gold - (confirm.price ?? 0),
          })}
          confirmLabel={t('shop.buy')}
          onConfirm={() => {
            const item = confirm;
            closeConfirm();
            buy.mutate(item.key, {
              onSuccess: (achievements) => {
                const extra = achievements
                  .map((a) => ` · ${a.icon} ${achievementText(a).name}`)
                  .join('');
                toast({
                  message: t('shop.bought', { name: item.name, extra }),
                  action: {
                    label: t('shop.equip'),
                    onPress: () => equip.mutate({ slot: item.slot, item: item.key }),
                  },
                });
              },
              onError: (e) => toast({ message: t('shop.error', { message: e.message }) }),
            });
          }}
          onClose={closeConfirm}
        />
      )}
    </Screen>
  );
}
