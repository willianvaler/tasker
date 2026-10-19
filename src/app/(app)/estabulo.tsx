import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ArtImage } from '@/components/game-art';
import { QuestCard } from '@/components/game-mode';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Tabs } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { favoriteFood, mountProgress } from '@/lib/game-mode';
import { gamificationConfig } from '@/lib/gamification.config';
import { useGameState } from '@/lib/queries/game';
import { useStable, useStableActions, type Stable } from '@/lib/queries/game-mode';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

const G = gamificationConfig.game;
type Tab = 'inventory' | 'pets' | 'mounts' | 'quests';

function useNames() {
  const { t } = useTranslation();
  const species = (s: string) => t(`pets.species.${s}` as 'pets.species.lobo');
  const potion = (p: string) => t(`pets.potions.${p}` as 'pets.potions.comum');
  const food = (f: string) => t(`pets.foods.${f}` as 'pets.foods.carne');
  const pet = (s: string, p: string) =>
    t('pets.petName', { species: species(s), potion: potion(p) });
  const quest = (q: string) => t(`quests.${q}.name` as 'quests.rei-esqueleto.name');
  return { species, potion, food, pet, quest };
}

// Estábulo do modo Completo (HB8, HB9): inventário de drops, chocar e alimentar mascotes,
// montarias, e pergaminhos de missão. Só online.
export default function StableScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('inventory');
  const stable = useStable();
  const online = useIsOnline();
  const data = stable.data ?? { stacks: [], pets: [], mounts: [] };
  return (
    <Screen size="wide">
      <ScreenHeader help="modo-jogo" title={t('pets.title')} back />
      <Tabs
        label={t('pets.title')}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'inventory', label: t('pets.inventory') },
          { value: 'pets', label: t('pets.pets') },
          { value: 'mounts', label: t('pets.mounts') },
          { value: 'quests', label: t('pets.quests') },
        ]}
      />
      <ScreenScroll contentContainerClassName="gap-6 pb-12 pt-4">
        {!online && <Text className="text-sm text-warn">{t('pets.offline')}</Text>}
        {tab === 'inventory' && <Inventory data={data} />}
        {tab === 'pets' && <Pets data={data} />}
        {tab === 'mounts' && <Mounts data={data} />}
        {tab === 'quests' && <Quests data={data} />}
      </ScreenScroll>
    </Screen>
  );
}

function Inventory({ data }: { data: Stable }) {
  const { t } = useTranslation();
  const n = useNames();
  if (data.stacks.length === 0) return <EmptyState title={t('pets.emptyInventory')} />;
  const label = (kind: string, key: string) =>
    kind === 'egg'
      ? t('pets.eggOf', { name: n.species(key) })
      : kind === 'potion'
        ? t('pets.potionOf', { name: n.potion(key) })
        : kind === 'food'
          ? n.food(key)
          : n.quest(key);
  return (
    <View className="gap-6">
      {(['egg', 'potion', 'food', 'scroll'] as const).map((kind) => {
        const rows = data.stacks.filter((s) => s.kind === kind);
        if (!rows.length) return null;
        const art = { egg: 'ovo', potion: 'pocao', food: 'comida', scroll: 'pergaminho' }[kind];
        return (
          <View key={kind} className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t(`pets.kinds.${kind}`)}
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {rows.map((s) => (
                <View key={s.key} className="w-36 items-center gap-1">
                  <ArtImage group="itens" id={art} size={64} fallback="📦" />
                  <Text className="text-center text-xs text-ink">{label(kind, s.key)}</Text>
                  <Text className="font-mono text-xs text-ink-muted">×{s.qty}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Pets({ data }: { data: Stable }) {
  const { t } = useTranslation();
  const n = useNames();
  const { data: game } = useGameState();
  const actions = useStableActions();
  const online = useIsOnline();
  const toast = useToast();
  const eggs = data.stacks.filter((s) => s.kind === 'egg');
  const potions = data.stacks.filter((s) => s.kind === 'potion');
  const foods = data.stacks.filter((s) => s.kind === 'food');
  // Combinações possíveis de chocar (que ainda não existem)
  const hatchable = eggs.flatMap((e) =>
    potions
      .filter((p) => !data.pets.some((x) => x.species === e.key && x.potion === p.key))
      .map((p) => ({ species: e.key, potion: p.key })),
  );
  return (
    <View className="gap-6">
      {hatchable.length > 0 && (
        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('pets.hatchTitle')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {hatchable.map((h) => (
              <Button
                key={`${h.species}:${h.potion}`}
                variant="ghost"
                label={t('pets.hatch', { name: n.pet(h.species, h.potion) })}
                disabled={!online}
                onPress={() =>
                  actions.hatch.mutate(h, {
                    onSuccess: () =>
                      toast({ message: t('pets.hatched', { name: n.pet(h.species, h.potion) }) }),
                    onError: (e) => toast({ message: e.message }),
                  })
                }
              />
            ))}
          </View>
        </View>
      )}
      {data.pets.length === 0 ? (
        <EmptyState title={t('pets.emptyPets')} />
      ) : (
        <View className="flex-row flex-wrap gap-6">
          {data.pets.map((p) => {
            const id = `${p.species}:${p.potion}`;
            const name = n.pet(p.species, p.potion);
            const fav = favoriteFood(p.potion);
            const active = game?.active_pet === id;
            return (
              <View key={id} className="w-56 gap-2">
                <ArtImage group="mascotes" id={p.species} size={224} fallback="🐾" label={name} />
                <Text className="font-serif text-base text-ink">{name}</Text>
                <ProgressBar
                  value={mountProgress(p.fed)}
                  label={t('pets.fed', { fed: p.fed, max: G.feedToMount })}
                />
                <Text className="font-mono text-xs text-ink-muted">
                  {t('pets.fed', { fed: p.fed, max: G.feedToMount })}
                </Text>
                {fav && (
                  <Text className="text-xs text-ink-muted">
                    {t('pets.favorite', { food: n.food(fav) })}
                  </Text>
                )}
                <View className="flex-row flex-wrap gap-2">
                  {foods.map((f) => (
                    <Button
                      key={f.key}
                      variant="ghost"
                      label={`${t('pets.feed', { food: n.food(f.key) })} ×${f.qty}`}
                      disabled={!online}
                      onPress={() =>
                        actions.feed.mutate(
                          { species: p.species, potion: p.potion, food: f.key },
                          {
                            onSuccess: (r) =>
                              toast({
                                message: r.mount
                                  ? t('pets.becameMount', { name })
                                  : t(r.favorite ? 'pets.ateFavorite' : 'pets.ate', {
                                      name,
                                      gain: r.favorite ? G.feedFavorite : G.feedOther,
                                    }),
                              }),
                            onError: (e) => toast({ message: e.message }),
                          },
                        )
                      }
                    />
                  ))}
                  <Button
                    variant={active ? 'ghost' : 'primary'}
                    label={active ? t('pets.leave') : t('pets.makeActive')}
                    disabled={!online}
                    onPress={() =>
                      actions.companion.mutate({ kind: 'pet', value: active ? null : id })
                    }
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function Mounts({ data }: { data: Stable }) {
  const { t } = useTranslation();
  const n = useNames();
  const { data: game } = useGameState();
  const actions = useStableActions();
  const online = useIsOnline();
  if (data.mounts.length === 0) return <EmptyState title={t('pets.emptyMounts')} />;
  return (
    <View className="flex-row flex-wrap gap-6">
      {data.mounts.map((m) => {
        const id = `${m.species}:${m.potion}`;
        const name = n.pet(m.species, m.potion);
        const active = game?.active_mount === id;
        return (
          <View key={id} className="w-56 gap-2">
            <ArtImage group="montarias" id={m.species} size={224} fallback="🐎" label={name} />
            <Text className="font-serif text-base text-ink">{name}</Text>
            <Button
              variant={active ? 'ghost' : 'primary'}
              className="self-start"
              label={active ? t('pets.leave') : t('pets.makeActive')}
              disabled={!online}
              onPress={() => actions.companion.mutate({ kind: 'mount', value: active ? null : id })}
            />
          </View>
        );
      })}
    </View>
  );
}

function Quests({ data }: { data: Stable }) {
  const { t } = useTranslation();
  const n = useNames();
  const { data: game } = useGameState();
  const actions = useStableActions();
  const online = useIsOnline();
  const toast = useToast();
  const scrolls = new Map(
    data.stacks.filter((s) => s.kind === 'scroll').map((s) => [s.key, s.qty]),
  );
  const active = game?.quests ?? [];
  const soloActive = active.some((q) => !q.quest_clan);
  const clanActive = active.some((q) => q.quest_clan);
  return (
    <View className="gap-6">
      {active.map((q) => (
        <QuestCard key={q.id} quest={q} />
      ))}
      <Text className="text-sm text-ink-muted">{t('quests.hint', { days: G.questDays })}</Text>
      {G.quests.map((q) => {
        const owned = scrolls.get(q.key) ?? 0;
        return (
          <View key={q.key} className="flex-row items-start gap-4 border-t border-line pt-4">
            <ArtImage group="bosses" id={q.key} size={112} fallback="📜" label={n.quest(q.key)} />
            <View className="flex-1 gap-2">
              <Text className="font-serif text-base text-ink">{n.quest(q.key)}</Text>
              <Text className="font-serif text-sm italic text-ink-muted">
                {t(`quests.${q.key}.chapter` as 'quests.rei-esqueleto.chapter')}
              </Text>
              <Text className="font-mono text-xs text-ink-muted">
                {q.hp} HP · {t('quests.owned', { count: owned })}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {owned > 0 ? (
                  <>
                    <Button
                      label={t('quests.start')}
                      disabled={!online || soloActive}
                      onPress={() =>
                        actions.startQuest.mutate(
                          { quest: q.key, clan: false },
                          {
                            onSuccess: () =>
                              toast({ message: t('quests.started', { name: n.quest(q.key) }) }),
                            onError: (e) => toast({ message: e.message }),
                          },
                        )
                      }
                    />
                    {game?.clan && (
                      <Button
                        variant="ghost"
                        label={t('quests.startClan')}
                        disabled={!online || clanActive}
                        onPress={() =>
                          actions.startQuest.mutate(
                            { quest: q.key, clan: true },
                            {
                              onSuccess: () =>
                                toast({ message: t('quests.started', { name: n.quest(q.key) }) }),
                              onError: (e) => toast({ message: e.message }),
                            },
                          )
                        }
                      />
                    )}
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    label={t('quests.buy', { price: G.scrollPrice })}
                    disabled={!online || (game?.gold ?? 0) < G.scrollPrice}
                    onPress={() =>
                      actions.buyScroll.mutate(q.key, {
                        onSuccess: () => toast({ message: t('quests.bought') }),
                        onError: (e) => toast({ message: e.message }),
                      })
                    }
                  />
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
