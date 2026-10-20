import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Panel } from '@/components/character';
import { ArtImage } from '@/components/game-art';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, PromptDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { gamificationConfig } from '@/lib/gamification.config';
import { useGameState } from '@/lib/queries/game';
import { useRewardActions, useRewards, type Reward } from '@/lib/queries/game-mode';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

const ARMOIRE = gamificationConfig.game.armoirePrice;

// Recompensas da vida real pagas com ouro e o baú encantado (HB7, ESCOPO_V8 §3). Valem no Leve
// e no Completo; só online (as tabelas não entram no sync).
export default function RewardsScreen() {
  const { t } = useTranslation();
  const { data: game } = useGameState();
  const rewards = useRewards();
  const actions = useRewardActions();
  const online = useIsOnline();
  const toast = useToast();
  const [editing, setEditing] = useState<Reward | 'new' | null>(null);
  const [removing, setRemoving] = useState<Reward | null>(null);
  const gold = game?.gold ?? 0;

  function save(values: Record<string, string>) {
    const cost = Math.round(Number(values.cost));
    if (!values.title?.trim()) return;
    if (!(cost >= 1 && cost <= 100000)) {
      toast({ message: t('rewards.costInvalid') });
      return;
    }
    actions.save.mutate(
      { id: editing && editing !== 'new' ? editing.id : undefined, title: values.title, cost },
      { onError: (e) => toast({ message: e.message }) },
    );
    setEditing(null);
  }

  return (
    <Screen size="medium">
      <ScreenHeader
        help="modo-jogo"
        title={t('rewards.title')}
        eyebrow={t('rewards.gold', { gold })}
        back
      />
      <ScreenScroll contentContainerClassName="gap-8 pb-12">
        <Text className="text-sm text-ink-muted">
          {t(online ? 'rewards.hint' : 'rewards.offline')}
        </Text>
        <View className="gap-2">
          {(rewards.data ?? []).length === 0 && !rewards.isPending && (
            <EmptyState title={t('rewards.empty')} />
          )}
          {(rewards.data ?? []).map((r) => (
            <View
              key={r.id}
              className="min-h-12 flex-row items-center gap-3 border-b border-line py-2"
            >
              <Text style={{ fontSize: 24, lineHeight: 30 }}>{r.icon ?? '🎁'}</Text>
              <View className="flex-1">
                <Text className="text-base text-ink">{r.title}</Text>
                <Text className="font-mono text-xs text-ink-muted">
                  {t('rewards.gold', { gold: r.cost })}
                </Text>
              </View>
              <Button
                variant="ghost"
                label={t('rewards.edit')}
                disabled={!online}
                onPress={() => setEditing(r)}
              />
              <Button
                destructive
                variant="ghost"
                label={t('rewards.delete')}
                disabled={!online}
                onPress={() => setRemoving(r)}
              />
              <Button
                label={
                  gold >= r.cost
                    ? t('rewards.redeem', { cost: r.cost })
                    : t('rewards.notEnough', { gold, cost: r.cost })
                }
                disabled={!online || gold < r.cost}
                loading={actions.redeem.isPending && actions.redeem.variables === r.id}
                onPress={() =>
                  actions.redeem.mutate(r.id, {
                    onSuccess: () => toast({ message: t('rewards.redeemed', { title: r.title }) }),
                    onError: (e) => toast({ message: e.message }),
                  })
                }
              />
            </View>
          ))}
          <Button
            variant="ghost"
            className="self-start"
            label={`+ ${t('rewards.new')}`}
            disabled={!online}
            onPress={() => setEditing('new')}
          />
        </View>

        <Panel title={t('rewards.armoire')}>
          <View className="flex-row items-center gap-4">
            <ArtImage group="itens" id="bau" size={96} fallback="🧰" />
            <Text className="flex-1 text-sm text-ink-muted">
              {t('rewards.armoireHint', { price: ARMOIRE })}
            </Text>
          </View>
          <Button
            className="self-start"
            label={t('rewards.armoireOpen', { price: ARMOIRE })}
            disabled={!online || gold < ARMOIRE}
            loading={actions.armoire.isPending}
            onPress={() =>
              actions.armoire.mutate(undefined, {
                onSuccess: (r) =>
                  toast({
                    message: r.item
                      ? t('rewards.armoireItem', { icon: r.item.icon, name: r.item.name })
                      : t('rewards.armoireFood', {
                          name: t(`pets.foods.${r.food ?? 'carne'}` as 'pets.foods.carne'),
                        }),
                  }),
                onError: (e) => toast({ message: e.message }),
              })
            }
          />
        </Panel>
      </ScreenScroll>

      {editing && (
        <PromptDialog
          title={editing === 'new' ? t('rewards.new') : t('rewards.edit')}
          fields={[
            {
              key: 'title',
              placeholder: t('rewards.name'),
              initial: editing === 'new' ? '' : editing.title,
              maxLength: 120,
            },
            {
              key: 'cost',
              placeholder: t('rewards.cost'),
              initial: editing === 'new' ? '' : String(editing.cost),
              maxLength: 6,
            },
          ]}
          onConfirm={save}
          onClose={() => setEditing(null)}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={t('rewards.delete')}
          message={t('rewards.deleteConfirm', { title: removing.title })}
          confirmLabel={t('rewards.delete')}
          destructive
          onConfirm={() => actions.remove.mutate(removing.id)}
          onClose={() => setRemoving(null)}
        />
      )}
    </Screen>
  );
}
