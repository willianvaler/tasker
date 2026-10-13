import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Avatar } from '@/components/character';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { Grid } from '@/components/ui/grid';
import { RARITY, SLOTS, type Slot } from '@/lib/character';
import { cn } from '@/lib/cn';
import { useBuyItem, useEquipItem, useGameState, useItems, type Item } from '@/lib/queries/game';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

// Loja (D64): só visual. Itens comprados com ouro; os raros de verdade só caem de boss.
export default function ShopScreen() {
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
        title="Loja"
        back
        right={
          <Text
            className="text-lg font-bold text-ink"
            accessibilityLabel={`${gold} de ouro`}
          >
            🪙 {gold}
          </Text>
        }
      />
      <ScrollView contentContainerClassName="gap-4 pb-16">
        <View className="flex-row items-center gap-4">
          {game && <Avatar game={game} size="md" />}
          <Text className="flex-1 text-sm text-ink-muted">
            Tudo aqui é só visual: não muda XP nem dano. Ganhe ouro concluindo tarefas e derrotando
            bosses; itens 🎁 só caem de boss (quanto maior o nível, mais chance de raro).
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
          <Chip role="radio" label="Tudo" selected={!slot} onPress={() => setSlot(null)} />
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
                  'flex-1 items-center justify-between gap-1 rounded-2xl border-2 bg-surface p-3',
                  rarity.border,
                  !mine && item.price === null && 'opacity-60',
                )}
              >
                <Text style={{ fontSize: 40, lineHeight: 48 }}>
                  {item.slot === 'title' ? '🏷️' : item.icon}
                </Text>
                <Text className="text-center font-semibold text-ink" numberOfLines={2}>
                  {item.slot === 'title' ? `${item.icon} ${item.name}` : item.name}
                </Text>
                <Text className={cn('text-xs font-semibold', rarity.text)}>{rarity.label}</Text>
                {mine ? (
                  <Button
                    variant={equipped ? 'primary' : 'outline'}
                    className="mt-1 self-stretch"
                    label={equipped ? '✓ Equipado' : 'Equipar'}
                    disabled={!online}
                    onPress={() =>
                      equip.mutate({ slot: item.slot, item: equipped ? null : item.key })
                    }
                  />
                ) : item.price === null ? (
                  <Text className="mt-1 min-h-11 text-center text-xs text-ink-muted">
                    🎁 Só cai de boss
                  </Text>
                ) : (
                  <Button
                    className="mt-1 self-stretch"
                    label={`🪙 ${item.price}`}
                    accessibilityLabel={`Comprar ${item.name} por ${item.price} de ouro`}
                    disabled={!online || gold < item.price}
                    onPress={() => setConfirm(item)}
                  />
                )}
              </View>
            );
          })}
        </Grid>
        {items.error && (
          <Text className="text-danger">Erro ao carregar a loja: {items.error.message}</Text>
        )}
      </ScrollView>

      {confirm && (
        <ConfirmDialog
          title={`Comprar ${confirm.name}?`}
          message={`Custa 🪙 ${confirm.price}. Você fica com 🪙 ${gold - (confirm.price ?? 0)}.`}
          confirmLabel="Comprar"
          variant="primary"
          onConfirm={() => {
            const item = confirm;
            closeConfirm();
            buy.mutate(item.key, {
              onSuccess: (achievements) => {
                const extra = achievements.map((a) => ` · ${a.icon} ${a.name}`).join('');
                toast({
                  message: `${item.icon} ${item.name} é seu!${extra}`,
                  action: {
                    label: 'Equipar',
                    onPress: () => equip.mutate({ slot: item.slot, item: item.key }),
                  },
                });
              },
              onError: (e) => toast({ message: `Não deu certo: ${e.message}` }),
            });
          }}
          onClose={closeConfirm}
        />
      )}
    </Screen>
  );
}
