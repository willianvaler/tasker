import { Link } from 'expo-router';
import { Backpack, Check, Plus, RotateCcw, ShoppingBag, Zap } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Grid } from '@/components/ui/grid';
import { Icon } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SectionLabel } from '@/components/ui/section-label';
import {
  ATTRIBUTES,
  AURA_BG,
  CLASS_KEYS,
  CLASSES,
  critChance,
  goldFor,
  healAmount,
  hitDamage,
  isClassKey,
  RARITY,
  SLOTS,
  type AttrKey,
  type ClassKey,
} from '@/lib/character';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { gamificationConfig as config } from '@/lib/gamification.config';
import {
  useAllocateAttribute,
  useEquipItem,
  useItems,
  useResetAttributes,
  useSetClass,
  useUseSkill,
  type GameState,
  type Item,
} from '@/lib/queries/game';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

/** Classe do estado do jogo (null se ainda não escolheu). */
export function classOf(game: GameState): ClassKey | null {
  return isClassKey(game.class) ? game.class : null;
}

function useItemMap() {
  const items = useItems();
  return new Map((items.data ?? []).map((i) => [i.key, i]));
}

const AVATAR = {
  sm: { box: 'h-14 w-14 rounded-lg', figure: 30, extra: 16 },
  md: { box: 'h-24 w-24 rounded-lg', figure: 48, extra: 24 },
  lg: { box: 'h-36 w-36 rounded-lg', figure: 72, extra: 34 },
} as const;

/** O personagem: figura da classe, aura de fundo e os itens equipados em volta (só visual). */
export function Avatar({ game, size = 'md' }: { game: GameState; size?: keyof typeof AVATAR }) {
  const { t } = useTranslation();
  const items = useItemMap();
  const cls = classOf(game);
  const s = AVATAR[size];
  const icon = (slot: string) => items.get(game.equipped[slot] ?? '')?.icon;
  const head = icon('head');
  const hand = icon('hand');
  const pet = icon('pet');
  const aura = game.equipped.aura ? AURA_BG[game.equipped.aura] : undefined;
  const emoji = (size: number) => ({ fontSize: size, lineHeight: Math.round(size * 1.2) });
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={
        cls ? t('character.avatar', { name: CLASSES[cls].name }) : t('character.avatarNoClass')
      }
      className={cn('items-center justify-center border border-line', s.box, aura ?? 'bg-wash')}
    >
      <Text style={emoji(s.figure)}>{cls ? CLASSES[cls].figure : '🧑'}</Text>
      {head && (
        <Text className="absolute -top-1" style={emoji(s.extra)}>
          {head}
        </Text>
      )}
      {hand && (
        <Text className="absolute -right-1 top-1/3" style={emoji(s.extra)}>
          {hand}
        </Text>
      )}
      {pet && (
        <Text className="absolute -bottom-1 -left-1" style={emoji(s.extra)}>
          {pet}
        </Text>
      )}
    </View>
  );
}

/** Título equipado ("Mente Focada"), ou nada. */
export function useEquippedTitle(game: GameState | undefined) {
  const items = useItemMap();
  return game?.equipped.title ? items.get(game.equipped.title)?.name : undefined;
}

/** O herói: personagem, nome, título, classe, nível, XP, ouro e pontos para distribuir. */
export function HeroCard({ game, name }: { game: GameState; name?: string }) {
  const { t } = useTranslation();
  const cls = classOf(game);
  const title = useEquippedTitle(game);
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-4">
        <Avatar game={game} size="lg" />
        <View className="flex-1 gap-1">
          {name ? (
            <Text className="font-serif text-lg text-ink" numberOfLines={1}>
              {name}
            </Text>
          ) : null}
          {title && <Text className="text-sm text-accent">« {title} »</Text>}
          <Text className="text-sm text-ink">
            {t('character.classLevel', {
              cls: cls ? CLASSES[cls].name : t('character.noClass'),
              level: game.level,
            })}
          </Text>
          <Text className="font-mono text-xs text-ink-muted">
            {t('character.goldStreak', { gold: game.gold, count: game.streak })}
          </Text>
        </View>
      </View>
      <View className="gap-1">
        <ProgressBar
          value={game.into_level / game.for_next}
          label={`${game.into_level}/${game.for_next} XP`}
        />
        <Text className="font-mono text-xs text-ink-muted">
          {t('character.toNext', {
            into: game.into_level,
            next: game.for_next,
            level: game.level + 1,
          })}
        </Text>
        {(game.points ?? 0) > 0 && (
          <Text className="font-mono text-xs text-accent">
            {t('character.points', { count: game.points ?? 0 })}
          </Text>
        )}
      </View>
    </View>
  );
}

/** Escolher (ou trocar) a classe. Classe é sabor + habilidades; dá para trocar quando quiser. */
export function ClassPicker({
  current,
  onDone,
}: {
  current: ClassKey | null;
  onDone?: () => void;
}) {
  const { t } = useTranslation();
  const setClass = useSetClass();
  const online = useIsOnline();
  const toast = useToast();
  return (
    <View className="gap-3">
      <Grid breakpoints={[700, 1100]}>
        {CLASS_KEYS.map((key) => {
          const c = CLASSES[key];
          const bonus = config.classes[key];
          const selected = current === key;
          return (
            <View
              key={key}
              className={cn(
                // Conteúdo em cima e botão no pé: os botões ficam alinhados na linha da grade
                'flex-1 justify-between gap-4 rounded-lg border bg-surface p-4',
                selected ? 'border-accent' : 'border-line',
              )}
            >
              <View className="gap-2">
                <View className="flex-row items-center gap-3">
                  <Text style={{ fontSize: 40, lineHeight: 48 }}>{c.figure}</Text>
                  <View className="flex-1">
                    <Text className="font-serif text-lg text-ink">{c.name}</Text>
                    <Text className="text-sm text-ink-muted">{c.blurb}</Text>
                  </View>
                </View>
                <Text className="font-mono text-xs text-ink">
                  {ATTRIBUTES.filter((a) => bonus[a.key] > 0)
                    .map((a) => `+${bonus[a.key]} ${a.label}`)
                    .join(' · ')}
                </Text>
                <Text className="text-sm text-ink">
                  <Text className="font-semibold">
                    {t('character.passive', { name: c.passive.name })}
                  </Text>{' '}
                  {c.passive.text}
                </Text>
                <Text className="text-sm text-ink">
                  <Text className="font-semibold">
                    {t('character.active', { name: c.active.name })}
                  </Text>{' '}
                  {c.active.text}
                </Text>
              </View>
              <Button
                label={
                  selected
                    ? t('character.current')
                    : t(current ? 'character.become' : 'character.choose', { name: c.name })
                }
                variant={selected ? 'ghost' : 'primary'}
                disabled={selected || !online}
                loading={setClass.isPending && setClass.variables === key}
                onPress={() =>
                  setClass.mutate(key, {
                    onSuccess: () => {
                      toast({ message: t('character.becameToast', { name: c.name }) });
                      onDone?.();
                    },
                    onError: (e) =>
                      toast({ message: t('character.error', { message: e.message }) }),
                  })
                }
              />
            </View>
          );
        })}
      </Grid>
    </View>
  );
}

/** Atributos com o efeito de cada um e o "+" para distribuir os pontos ganhos ao subir de nível. */
export function AttributesPanel({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const allocate = useAllocateAttribute();
  const reset = useResetAttributes();
  const online = useIsOnline();
  const toast = useToast();
  const cls = classOf(game);
  const points = game.points ?? 0;
  const spent = Object.values(game.allocated).reduce((a, b) => a + b, 0);
  return (
    <Panel
      title={t('character.attributes')}
      right={
        <Text className={cn('font-mono text-xs', points > 0 ? 'text-accent' : 'text-ink-muted')}>
          {points > 0 ? t('character.points', { count: points }) : t('character.perLevel')}
        </Text>
      }
    >
      {ATTRIBUTES.map((a) => {
        const classBonus = cls ? config.classes[cls][a.key] : 0;
        return (
          <View
            key={a.key}
            className="min-h-12 flex-row items-center gap-3 border-b border-line py-1"
          >
            <View className="flex-1">
              <Text className="text-sm font-semibold text-ink">
                {a.label}{' '}
                <Text className="font-mono text-xs text-ink-muted">
                  ({t('character.attrBreakdown', { base: config.attributes.base })}
                  {classBonus ? t('character.attrClass', { n: classBonus }) : ''}
                  {game.allocated[a.key]
                    ? t('character.attrMine', { n: game.allocated[a.key] })
                    : ''}
                  )
                </Text>
              </Text>
              <Text className="text-xs text-ink-muted">{a.effect}</Text>
            </View>
            <Text
              className="w-8 text-center font-mono text-base text-ink"
              accessibilityLabel={t('character.attrValue', {
                name: a.label,
                value: game.attributes[a.key as AttrKey],
              })}
            >
              {game.attributes[a.key as AttrKey]}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('character.addPoint', { name: a.label })}
              aria-disabled={points < 1 || !online}
              disabled={points < 1 || !online || allocate.isPending}
              onPress={() =>
                allocate.mutate(a.key, {
                  onError: (e) => toast({ message: t('character.error', { message: e.message }) }),
                })
              }
              className={cn(
                'h-11 w-11 items-center justify-center rounded border border-line hover:bg-wash md:h-8 md:w-8',
                (points < 1 || !online) && 'opacity-40',
              )}
            >
              <Icon icon={Plus} tone="accent" />
            </Pressable>
          </View>
        );
      })}
      {spent > 0 && (
        <Button
          variant="ghost"
          className="self-start"
          icon={RotateCcw}
          label={t('character.resetPoints')}
          disabled={!online}
          onPress={() => reset.mutate(undefined)}
        />
      )}
    </Panel>
  );
}

/** Passiva e habilidade ativa da classe. */
export function SkillsPanel({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const use = useUseSkill();
  const online = useIsOnline();
  const toast = useToast();
  const cls = classOf(game);
  if (!cls) return null;
  const c = CLASSES[cls];
  return (
    <Panel title={t('character.skills')}>
      <View className="gap-1">
        <Text className="text-sm font-semibold text-ink">
          {t('character.passiveLabel', { name: c.passive.name })}
        </Text>
        <Text className="text-sm text-ink-muted">{c.passive.text}</Text>
        {cls === 'lutador' && (
          <Text className="font-mono text-xs text-ink-muted">
            {t(
              game.first_strike_ready ? 'character.firstStrikeReady' : 'character.firstStrikeUsed',
            )}
          </Text>
        )}
      </View>
      <View className="gap-2 border-t border-line pt-3">
        <Text className="text-sm font-semibold text-ink">{c.active.name}</Text>
        <Text className="text-sm text-ink-muted">
          {t('character.oncePerDay', { text: c.active.text })}
        </Text>
        <Button
          icon={game.skill_active ? Check : Zap}
          className="self-start"
          label={
            game.skill_active
              ? t('character.activeUntil')
              : t('character.use', { name: c.active.name })
          }
          variant={game.skill_active ? 'ghost' : 'primary'}
          disabled={game.skill_active || !online}
          loading={use.isPending}
          onPress={() =>
            use.mutate(undefined, {
              onSuccess: () =>
                toast({ message: t('character.usedToast', { name: c.active.name }) }),
              onError: (e) => toast({ message: t('character.error', { message: e.message }) }),
            })
          }
        />
      </View>
    </Panel>
  );
}

/** "Seu golpe agora": a conta do dano com os seus atributos (espelho do servidor). */
export function DamagePanel({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const cls = classOf(game);
  const attrs = game.attributes;
  const opts = { streak: game.streak, skillActive: game.skill_active };
  const d = config.damage;
  const rows: { label: string; base: number; category: 'task' | 'routine' }[] = [
    { label: t('character.rowTask'), base: d.task, category: 'task' },
    {
      label: t('character.rowTaskHigh'),
      base: d.task * config.xp.priorityMultiplier[3],
      category: 'task',
    },
    { label: t('character.rowHabit'), base: d.habit, category: 'routine' },
    { label: t('character.rowCard'), base: d.checklistItem, category: 'routine' },
    { label: t('character.rowGood'), base: d.habitPlus, category: 'routine' },
  ];
  const chance = critChance(cls, attrs, game.skill_active);
  return (
    <Panel title={t('character.damage')}>
      <View>
        {rows.map((r) => {
          const hit = hitDamage(r.base, r.category, cls, attrs, opts);
          return (
            <View
              key={r.label}
              className="min-h-8 flex-row items-center justify-between border-b border-line"
            >
              <Text className="text-sm text-ink">{r.label}</Text>
              <Text className="font-mono text-xs text-ink">
                {hit.normal}
                <Text className="font-mono text-xs text-ink-muted">
                  {' · '}
                  {t('character.crit', { n: hit.crit })}
                </Text>
              </Text>
            </View>
          );
        })}
        <View className="min-h-8 flex-row items-center justify-between">
          <Text className="text-sm text-ink">{t('character.rowBad')}</Text>
          <Text className="font-mono text-xs text-danger">
            {t('character.heals', { n: healAmount(cls, attrs) })}
          </Text>
        </View>
      </View>
      <Text className="text-xs text-ink-muted">
        {t('character.damageHint', {
          chance: Math.round(chance * 100),
          gold: goldFor(config.gold.task, cls, attrs),
          first:
            cls === 'lutador' && game.first_strike_ready
              ? t('character.firstStrikeNext', { mult: config.skills.firstStrikeMultiplier })
              : '',
          perPoint: Math.round(d.perPoint * 100),
          cap: config.antiFarm.dailyQuickDamageCap,
        })}
      </Text>
    </Panel>
  );
}

/** Espaços do equipamento e o inventário (tocar equipa/tira). */
export function EquipmentPanel({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const items = useItems();
  const equip = useEquipItem();
  const online = useIsOnline();
  const owned = (items.data ?? []).filter((i) => game.inventory.includes(i.key));
  return (
    <Panel
      title={t('character.equipment')}
      right={
        <View className="flex-row gap-1">
          <Link href="/inventario" asChild>
            <Pressable
              accessibilityRole="link"
              className="min-h-8 flex-row items-center gap-1 rounded px-2 hover:bg-wash"
            >
              <Icon icon={Backpack} tone="ink" />
              <Text className="text-xs font-semibold text-ink">{t('inventory.open')}</Text>
            </Pressable>
          </Link>
          <Link href="/shop" asChild>
            <Pressable
              accessibilityRole="link"
              className="min-h-8 flex-row items-center gap-1 rounded px-2 hover:bg-wash"
            >
              <Icon icon={ShoppingBag} tone="ink" />
              <Text className="text-xs font-semibold text-ink">{t('character.shop')}</Text>
            </Pressable>
          </Link>
        </View>
      }
    >
      {SLOTS.map((slot) => {
        const mine = owned.filter((i) => i.slot === slot.key);
        return (
          <View key={slot.key} className="gap-1">
            <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {slot.label}
            </Text>
            {mine.length === 0 ? (
              <Text className="text-sm text-ink-muted">{t('character.nothingYet')}</Text>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {mine.map((item) => (
                  <ItemChip
                    key={item.key}
                    item={item}
                    equipped={game.equipped[slot.key] === item.key}
                    disabled={!online}
                    onPress={() =>
                      equip.mutate({
                        slot: slot.key,
                        item: game.equipped[slot.key] === item.key ? null : item.key,
                      })
                    }
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}
    </Panel>
  );
}

function ItemChip({
  item,
  equipped,
  disabled,
  onPress,
}: {
  item: Item;
  equipped: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={equipped}
      accessibilityLabel={t('character.itemLabel', {
        name: item.name,
        rarity: RARITY[item.rarity].label,
      })}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'min-h-11 flex-row items-center gap-2 rounded border px-2 hover:bg-wash md:min-h-8',
        equipped ? 'border-accent bg-accent-soft' : RARITY[item.rarity].border,
      )}
    >
      {/* Ícone do item: conteúdo do jogo, como o personagem */}
      <Text className="text-base">{item.icon}</Text>
      <Text className="text-sm text-ink">{item.name}</Text>
      {equipped && <Icon icon={Check} tone="accent" />}
    </Pressable>
  );
}

/** Grupo com rótulo (telas de personagem e loja): sem caixa, só o rótulo e a divisória. */
export function Panel({
  title,
  right,
  children,
  className,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <View className={cn('gap-3', className)}>
      <SectionLabel title={title} right={right} />
      {children}
    </View>
  );
}
