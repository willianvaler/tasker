import type { TFunction } from 'i18next';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { Avatar, classOf, Panel } from '@/components/character';
import { ArtImage, bossArtId } from '@/components/game-art';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog, DialogFrame } from '@/components/ui/dialog';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import { cn } from '@/lib/cn';
import { GAME_ART } from '@/lib/game-art';
import { gamificationConfig } from '@/lib/gamification.config';
import { rewardMessage } from '@/lib/gamification';
import {
  manaSkillBlock,
  manaSkillsFor,
  parseCompanion,
  portraitKey,
  strikeDamage,
  type ManaSkill,
} from '@/lib/game-mode';
import {
  useGameLevel,
  useGameState,
  useItems,
  type Boss,
  type GameState,
} from '@/lib/queries/game';
import {
  useAppearanceActions,
  useBuyPotion,
  useCastManaSkill,
  useDayStart,
  useDayStartPreview,
  useRevive,
  useSetGamePref,
} from '@/lib/queries/game-mode';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

const G = gamificationConfig.game;

// ---------- Vida e mana (HB5, HB6)

export function VitalBars({ game }: { game: GameState }) {
  const { t } = useTranslation();
  return (
    <View className="gap-2">
      <View className="gap-1">
        <ProgressBar
          value={game.hp / game.max_hp}
          fillClassName={game.hp / game.max_hp < 0.3 ? 'bg-danger' : 'bg-ok'}
          label={t('game.hpLabel', { hp: game.hp, max: game.max_hp })}
        />
        <Text className="font-mono text-xs text-ink-muted">
          ❤ {t('game.hpLabel', { hp: game.hp, max: game.max_hp })}
        </Text>
      </View>
      <View className="gap-1">
        <ProgressBar
          value={game.mp / Math.max(1, game.max_mp)}
          fillClassName="bg-rarity-rare"
          label={t('game.mpLabel', { mp: game.mp, max: game.max_mp })}
        />
        <Text className="font-mono text-xs text-ink-muted">
          ✦ {t('game.mpLabel', { mp: game.mp, max: game.max_mp })}
        </Text>
      </View>
      {game.resting && <Text className="text-xs text-accent">{t('game.tavernOn')}</Text>}
      {game.stealth > 0 && (
        <Text className="text-xs text-ink-muted">{t('game.stealth', { count: game.stealth })}</Text>
      )}
      {game.shield && <Text className="text-xs text-ink-muted">{t('game.shield')}</Text>}
      {game.buff > 0 && (
        <Text className="text-xs text-ok">{t('game.buff', { buff: game.buff })}</Text>
      )}
    </View>
  );
}

/** Taverna e poção: o que cuida da vida. */
export function VitalActions({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const online = useIsOnline();
  const pref = useSetGamePref();
  const potion = useBuyPotion();
  const toast = useToast();
  return (
    <View className="flex-row flex-wrap gap-2">
      <Button
        variant="ghost"
        label={game.resting ? t('game.tavernLeave') : t('game.tavern')}
        accessibilityHint={t('game.tavernHint')}
        disabled={!online}
        onPress={() => pref.mutate({ resting: !game.resting })}
      />
      <Button
        variant="ghost"
        label={t('game.potion', { heal: G.potionHeal, price: G.potionPrice })}
        disabled={!online || game.gold < G.potionPrice || game.hp >= game.max_hp}
        loading={potion.isPending}
        onPress={() =>
          potion.mutate(undefined, {
            onSuccess: () => toast({ message: t('game.potionDone', { heal: G.potionHeal }) }),
            onError: (e) => toast({ message: e.message }),
          })
        }
      />
    </View>
  );
}

// ---------- Retrato pintado com cenário, mascote e montaria (HB10)

export function HeroPortrait({ game, size = 144 }: { game: GameState; size?: number }) {
  const { t } = useTranslation();
  const cls = classOf(game);
  const key = portraitKey(cls, game.avatar.portrait);
  const portrait = key ? (GAME_ART.retratos as Record<string, number>)[key] : undefined;
  if (!portrait) return <Avatar game={game} size={size >= 144 ? 'lg' : 'md'} />;
  const background = (GAME_ART.cenarios as Record<string, number>)[
    game.avatar.background ?? 'acampamento'
  ];
  const pet = parseCompanion(game.active_pet);
  const mount = parseCompanion(game.active_mount);
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={t('game.portraitOf')}
      className="overflow-hidden rounded-lg border border-line bg-wash"
      style={{ width: size, height: size }}
    >
      {background && (
        <Image source={background} contentFit="cover" style={{ position: 'absolute', inset: 0 }} />
      )}
      <Image source={portrait} contentFit="contain" style={{ width: size, height: size }} />
      {mount && (
        <View className="absolute bottom-1 left-1">
          <ArtImage
            group="montarias"
            id={mount.species}
            size={Math.round(size / 3.2)}
            fallback="🐎"
          />
        </View>
      )}
      {pet && (
        <View className="absolute bottom-1 right-1">
          <ArtImage group="mascotes" id={pet.species} size={Math.round(size / 3.6)} fallback="🐾" />
        </View>
      )}
    </View>
  );
}

// ---------- Missão em andamento (HB9)

export function QuestCard({
  quest,
}: {
  quest: Boss & { quest_key: string; quest_clan?: boolean | null };
}) {
  const { t } = useTranslation();
  const key = quest.quest_key as 'rei-esqueleto';
  return (
    <View className="gap-3 border-t border-line pt-4">
      <View className="flex-row items-start gap-4">
        <ArtImage
          group="bosses"
          id={bossArtId(quest)}
          size={96}
          fallback="📜"
          label={t(`quests.${key}.name`)}
        />
        <View className="flex-1 gap-1">
          <Text className="font-serif text-base text-ink">
            {t(`quests.${key}.name`)}
            {quest.quest_clan ? ` · ${t('quests.clanTag')}` : ''}
          </Text>
          <Text className="font-serif text-sm italic text-ink-muted">
            {t(`quests.${key}.chapter`)}
          </Text>
        </View>
      </View>
      <ProgressBar
        value={quest.hp / quest.max_hp}
        label={t('boss.label', {
          name: quest.name,
          hp: quest.hp,
          max: quest.max_hp,
          unit: t('boss.unitHp'),
        })}
      />
      <Text className="font-mono text-xs text-ink-muted">
        {t('boss.hp', { hp: quest.hp, max: quest.max_hp })}
      </Text>
    </View>
  );
}

// ---------- Habilidades de mana (HB6)

function effectText(t: TFunction, skill: ManaSkill, str: number): string {
  const key = `game.effects.${skill.effect}` as 'game.effects.strike';
  return t(key, { damage: strikeDamage(skill, str), power: skill.power });
}

export function ManaSkillsPanel({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const cast = useCastManaSkill();
  const online = useIsOnline();
  const toast = useToast();
  const skills = manaSkillsFor(classOf(game));
  if (!skills.length) return null;
  return (
    <Panel title={t('game.manaTitle')}>
      <Text className="text-xs text-ink-muted">{t('game.manaHint')}</Text>
      <Text className="font-mono text-xs text-ink">
        ✦ {t('game.mpLabel', { mp: game.mp, max: game.max_mp })}
      </Text>
      {skills.map((skill) => {
        const name = t(`game.skills.${skill.key}` as 'game.skills.golpe_brutal');
        const block = manaSkillBlock(skill, game);
        return (
          <View key={skill.key} className="gap-1 border-t border-line pt-3">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-sm font-semibold text-ink">{name}</Text>
              <Button
                variant={block ? 'ghost' : 'primary'}
                label={
                  block === 'level'
                    ? t('game.locked', { level: skill.level })
                    : t('game.cast', { mana: skill.mana })
                }
                disabled={!!block || !online}
                loading={cast.isPending && cast.variables === skill.key}
                onPress={() =>
                  cast.mutate(skill.key, {
                    onSuccess: (r) => {
                      const extra = r.summary ? rewardMessage(r.summary) : null;
                      toast({
                        message: [
                          t('game.castDone', {
                            name,
                            effect: effectText(t, skill, game.attributes.str),
                          }),
                          extra,
                        ]
                          .filter(Boolean)
                          .join(' · '),
                      });
                    },
                    onError: (e) => toast({ message: e.message }),
                  })
                }
              />
            </View>
            <Text className="text-xs text-ink-muted">
              {effectText(t, skill, game.attributes.str)}
            </Text>
          </View>
        );
      })}
    </Panel>
  );
}

// ---------- Aparência e fantasia (HB10)

export function AppearancePanel({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const online = useIsOnline();
  const actions = useAppearanceActions();
  const pref = useSetGamePref();
  const items = useItems();
  const cls = classOf(game);
  if (!cls) return null;
  const portrait = game.avatar.portrait ?? G.portraits[0];
  const background = game.avatar.background ?? 'acampamento';
  const set = (p: string, b: string) => actions.appearance.mutate({ portrait: p, background: b });
  const owned = (items.data ?? []).filter((i) => game.inventory.includes(i.key));
  return (
    <Panel title={t('game.appearance')}>
      <HeroPortrait game={game} size={160} />
      <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {t('game.portrait')}
      </Text>
      <View
        className="flex-row flex-wrap gap-2"
        accessibilityRole="radiogroup"
        accessibilityLabel={t('game.portrait')}
      >
        {G.portraits.map((v) => (
          <Pressable
            key={v}
            accessibilityRole="radio"
            aria-checked={portrait === v}
            accessibilityLabel={t(`game.portraits.${v}` as 'game.portraits.f-clara')}
            disabled={!online}
            onPress={() => set(v, background)}
            className={cn(
              'rounded-lg border-2',
              portrait === v ? 'border-accent' : 'border-transparent',
            )}
          >
            <ArtImage group="retratos" id={`${cls}-${v}`} size={56} fallback="🧑" />
          </Pressable>
        ))}
      </View>
      <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {t('game.background')}
      </Text>
      <View
        className="flex-row flex-wrap gap-2"
        accessibilityRole="radiogroup"
        accessibilityLabel={t('game.background')}
      >
        {G.backgrounds.map((b) => (
          <Chip
            key={b}
            role="radio"
            label={t(`game.backgrounds.${b}` as 'game.backgrounds.acampamento')}
            selected={background === b}
            disabled={!online}
            onPress={() => set(portrait, b)}
          />
        ))}
      </View>
      <ToggleRow
        title={t('game.costume')}
        hint={t('game.costumeHint')}
        value={game.use_costume}
        disabled={!online}
        onChange={(value) => pref.mutate({ use_costume: value })}
      />
      {game.use_costume && owned.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {owned.map((item) => {
            const on = game.costume[item.slot] === item.key;
            return (
              <Chip
                key={item.key}
                role="checkbox"
                label={`${item.icon} ${item.name}`}
                selected={on}
                disabled={!online}
                onPress={() =>
                  actions.costume.mutate({ slot: item.slot, item: on ? null : item.key })
                }
              />
            );
          })}
        </View>
      )}
    </Panel>
  );
}

// ---------- Virada do dia e morte (HB5): montado uma vez, por cima das telas

export function GameGate() {
  const level = useGameLevel();
  const { data: game } = useGameState();
  if (level !== 'full' || !game) return null;
  if (game.dead) return <DeathDialog game={game} />;
  return <DayStartDialog />;
}

function DayStartDialog() {
  const { t } = useTranslation();
  const preview = useDayStartPreview();
  const start = useDayStart();
  const toast = useToast();
  const [did, setDid] = useState<string[]>([]);
  const data = preview.data;
  if (!data?.pending) return null;
  const go = () =>
    start.mutate(did, {
      onSuccess: (r) => {
        if (!r.applied) return;
        const parts = [
          (r.damage ?? 0) > 0
            ? t('game.dayStartDamage', { count: r.missed ?? 0, damage: r.damage })
            : t('game.dayStartClean'),
          r.perfect ? t('game.perfect', { buff: r.buff ?? 0 }) : null,
          (r.mp_gain ?? 0) > 0 ? t('game.mpGain', { mp: r.mp_gain }) : null,
        ];
        toast({ message: parts.filter(Boolean).join(' · ') });
      },
    });
  // Nada a perguntar: aplica direto (sem diálogo)
  if (data.items.length === 0) {
    if (!start.isPending && !start.isSuccess) go();
    return null;
  }
  return (
    <DialogFrame onClose={go} wide>
      <Text accessibilityRole="header" className="font-serif text-xl text-ink">
        {t('game.dayStartTitle')}
      </Text>
      <Text className="text-sm text-ink-muted">
        {data.resting ? t('game.dayStartResting') : t('game.dayStartHint')}
      </Text>
      <View>
        {data.items.map((item) => (
          <Pressable
            key={item.id}
            className="min-h-11 flex-row items-center gap-3 border-b border-line"
            onPress={() =>
              setDid((d) =>
                d.includes(item.id) ? d.filter((x) => x !== item.id) : [...d, item.id],
              )
            }
          >
            <Checkbox
              checked={did.includes(item.id)}
              label={item.title}
              onChange={() =>
                setDid((d) =>
                  d.includes(item.id) ? d.filter((x) => x !== item.id) : [...d, item.id],
                )
              }
            />
            <Text className="flex-1 text-sm text-ink">{item.title}</Text>
          </Pressable>
        ))}
      </View>
      <Button label={t('game.dayStartGo')} loading={start.isPending} onPress={go} />
    </DialogFrame>
  );
}

function DeathDialog({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const revive = useRevive();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const canBuy = game.gold >= G.revivePrice;
  return (
    <>
      <DialogFrame onClose={() => undefined} wide>
        <ArtImage group="itens" id="vida" size={96} fallback="💀" className="self-center" />
        <Text accessibilityRole="header" className="font-serif text-xl text-ink">
          {t('game.deadTitle')}
        </Text>
        <Text className="text-sm text-ink-muted">
          {t('game.deadBody', { price: G.revivePrice })}
        </Text>
        {!canBuy && (
          <Text className="text-sm text-warn">{t('game.noGold', { gold: game.gold })}</Text>
        )}
        <Button
          label={t('game.buyLife', { price: G.revivePrice })}
          disabled={!canBuy}
          loading={revive.isPending && revive.variables === true}
          onPress={() =>
            revive.mutate(true, {
              onSuccess: () => toast({ message: t('game.revived') }),
              onError: (e) => toast({ message: e.message }),
            })
          }
        />
        <Button variant="ghost" label={t('game.restart')} onPress={() => setConfirm(true)} />
      </DialogFrame>
      {confirm && (
        <ConfirmDialog
          title={t('game.restart')}
          message={t('game.restartConfirm')}
          confirmLabel={t('game.restart')}
          onClose={() => setConfirm(false)}
          onConfirm={() =>
            revive.mutate(false, {
              onSuccess: () => {
                toast({ message: t('game.restarted') });
                router.replace('/');
              },
            })
          }
        />
      )}
    </>
  );
}
