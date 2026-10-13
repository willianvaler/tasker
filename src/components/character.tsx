import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ProgressBar } from '@/components/ui/progress-bar';
import { Button } from '@/components/ui/button';
import { Grid } from '@/components/ui/grid';
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
  sm: { box: 'h-14 w-14 rounded-xl', figure: 30, extra: 16 },
  md: { box: 'h-24 w-24 rounded-2xl', figure: 48, extra: 24 },
  lg: { box: 'h-36 w-36 rounded-3xl', figure: 72, extra: 34 },
} as const;

/** O personagem: figura da classe, aura de fundo e os itens equipados em volta (só visual, D64). */
export function Avatar({ game, size = 'md' }: { game: GameState; size?: keyof typeof AVATAR }) {
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
      accessibilityLabel={cls ? `Personagem: ${CLASSES[cls].name}` : 'Personagem sem classe'}
      className={cn('items-center justify-center border border-border', s.box, aura ?? 'bg-muted')}
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

/** Cartão do herói: personagem, classe, nível, XP, ouro e pontos para distribuir. */
export function HeroCard({ game, name }: { game: GameState; name?: string }) {
  const cls = classOf(game);
  const title = useEquippedTitle(game);
  return (
    <View className="gap-3 rounded-2xl border border-border bg-card p-4">
      <View className="flex-row items-center gap-4">
        <Avatar game={game} size="lg" />
        <View className="flex-1 gap-1">
          {name ? (
            <Text className="text-xl font-bold text-foreground" numberOfLines={1}>
              {name}
            </Text>
          ) : null}
          {title && <Text className="text-sm italic text-primary">« {title} »</Text>}
          <Text className="text-base text-foreground">
            {cls ? `${CLASSES[cls].icon} ${CLASSES[cls].name}` : 'Sem classe'} · Nível {game.level}
          </Text>
          <Text className="text-sm text-muted-foreground">
            🪙 {game.gold} de ouro · 🔥 {game.streak} {game.streak === 1 ? 'dia' : 'dias'}
          </Text>
        </View>
      </View>
      <View className="gap-1">
        <ProgressBar
          value={game.into_level / game.for_next}
          label={`Nível ${game.level}: ${game.into_level} de ${game.for_next} XP`}
        />
        <Text className="text-xs text-muted-foreground">
          {game.into_level}/{game.for_next} XP para o nível {game.level + 1}
          {(game.points ?? 0) > 0 ? ` · ✨ ${game.points} ponto(s) para distribuir` : ''}
        </Text>
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
                'flex-1 justify-between gap-3 rounded-2xl border bg-card p-4',
                selected ? 'border-primary' : 'border-border',
              )}
            >
              <View className="gap-2">
                <View className="flex-row items-center gap-3">
                  <Text style={{ fontSize: 40, lineHeight: 48 }}>{c.figure}</Text>
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-foreground">
                      {c.icon} {c.name}
                    </Text>
                    <Text className="text-sm text-muted-foreground">{c.blurb}</Text>
                  </View>
                </View>
                <Text className="text-sm text-foreground">
                  {ATTRIBUTES.filter((a) => bonus[a.key] > 0)
                    .map((a) => `+${bonus[a.key]} ${a.label}`)
                    .join(' · ')}
                </Text>
                <Text className="text-sm text-foreground">
                  <Text className="font-semibold">Passiva: {c.passive.name}.</Text> {c.passive.text}
                </Text>
                <Text className="text-sm text-foreground">
                  <Text className="font-semibold">Habilidade: {c.active.name}.</Text>{' '}
                  {c.active.text}
                </Text>
              </View>
              <Button
                label={
                  selected ? 'Classe atual' : current ? `Virar ${c.name}` : `Escolher ${c.name}`
                }
                variant={selected ? 'outline' : 'primary'}
                disabled={selected || !online}
                loading={setClass.isPending && setClass.variables === key}
                onPress={() =>
                  setClass.mutate(key, {
                    onSuccess: () => {
                      toast({ message: `${c.icon} Agora você é ${c.name}!` });
                      onDone?.();
                    },
                    onError: (e) => toast({ message: `Não deu certo: ${e.message}` }),
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
  const allocate = useAllocateAttribute();
  const reset = useResetAttributes();
  const online = useIsOnline();
  const toast = useToast();
  const cls = classOf(game);
  const points = game.points ?? 0;
  const spent = Object.values(game.allocated).reduce((a, b) => a + b, 0);
  return (
    <Panel
      title="Atributos"
      right={
        <Text
          className={cn('text-sm', points > 0 ? 'font-bold text-primary' : 'text-muted-foreground')}
        >
          {points > 0 ? `✨ ${points} para distribuir` : 'Ganhe 1 ponto a cada nível'}
        </Text>
      }
    >
      {ATTRIBUTES.map((a) => {
        const classBonus = cls ? config.classes[cls][a.key] : 0;
        return (
          <View key={a.key} className="flex-row items-center gap-3 py-1">
            <Text style={{ fontSize: 22, lineHeight: 28 }}>{a.icon}</Text>
            <View className="flex-1">
              <Text className="font-semibold text-foreground">
                {a.label}{' '}
                <Text className="text-xs font-normal text-muted-foreground">
                  ({config.attributes.base} base
                  {classBonus ? ` + ${classBonus} da classe` : ''}
                  {game.allocated[a.key] ? ` + ${game.allocated[a.key]} seus` : ''})
                </Text>
              </Text>
              <Text className="text-xs text-muted-foreground">{a.effect}</Text>
            </View>
            <Text
              className="w-8 text-center text-xl font-bold text-foreground"
              accessibilityLabel={`${a.label}: ${game.attributes[a.key as AttrKey]}`}
            >
              {game.attributes[a.key as AttrKey]}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Mais um ponto em ${a.label}`}
              aria-disabled={points < 1 || !online}
              disabled={points < 1 || !online || allocate.isPending}
              onPress={() =>
                allocate.mutate(a.key, {
                  onError: (e) => toast({ message: `Não deu certo: ${e.message}` }),
                })
              }
              className={cn(
                'h-11 w-11 items-center justify-center rounded-full border border-primary active:opacity-70',
                (points < 1 || !online) && 'opacity-30',
              )}
            >
              <Text className="text-xl font-bold text-primary">+</Text>
            </Pressable>
          </View>
        );
      })}
      {spent > 0 && (
        <Button
          variant="ghost"
          className="self-start"
          label="Redistribuir pontos"
          disabled={!online}
          onPress={() => reset.mutate(undefined)}
        />
      )}
    </Panel>
  );
}

/** Passiva e habilidade ativa da classe. */
export function SkillsPanel({ game }: { game: GameState }) {
  const use = useUseSkill();
  const online = useIsOnline();
  const toast = useToast();
  const cls = classOf(game);
  if (!cls) return null;
  const c = CLASSES[cls];
  return (
    <Panel title="Habilidades">
      <View className="gap-1">
        <Text className="font-semibold text-foreground">🌙 Passiva: {c.passive.name}</Text>
        <Text className="text-sm text-muted-foreground">{c.passive.text}</Text>
        {cls === 'lutador' && (
          <Text className="text-xs text-muted-foreground">
            {game.first_strike_ready ? 'Pronta para o primeiro golpe de hoje.' : 'Já usada hoje.'}
          </Text>
        )}
      </View>
      <View className="gap-2 rounded-xl border border-border p-3">
        <Text className="font-semibold text-foreground">⚡ {c.active.name}</Text>
        <Text className="text-sm text-muted-foreground">{c.active.text} Uma vez por dia.</Text>
        <Button
          label={game.skill_active ? '✓ Ativa até o fim do dia' : `Usar ${c.active.name}`}
          variant={game.skill_active ? 'outline' : 'primary'}
          disabled={game.skill_active || !online}
          loading={use.isPending}
          onPress={() =>
            use.mutate(undefined, {
              onSuccess: () => toast({ message: `⚡ ${c.active.name}! Vale até o fim do dia.` }),
              onError: (e) => toast({ message: `Não deu certo: ${e.message}` }),
            })
          }
        />
      </View>
    </Panel>
  );
}

/** "Seu golpe agora": a conta do dano com os seus atributos (espelho do servidor, D61). */
export function DamagePanel({ game }: { game: GameState }) {
  const cls = classOf(game);
  const attrs = game.attributes;
  const opts = { streak: game.streak, skillActive: game.skill_active };
  const d = config.damage;
  const rows: { label: string; base: number; category: 'task' | 'routine' }[] = [
    { label: 'Tarefa', base: d.task, category: 'task' },
    { label: 'Tarefa !!!', base: d.task * config.xp.priorityMultiplier[3], category: 'task' },
    { label: 'Hábito ou recorrente', base: d.habit, category: 'routine' },
    { label: 'Card ou subtarefa', base: d.checklistItem, category: 'routine' },
    { label: 'Hábito bom (+)', base: d.habitPlus, category: 'routine' },
  ];
  const chance = critChance(cls, attrs, game.skill_active);
  return (
    <Panel title="Seu golpe agora">
      <View className="gap-1">
        {rows.map((r) => {
          const hit = hitDamage(r.base, r.category, cls, attrs, opts);
          return (
            <View key={r.label} className="flex-row items-center justify-between">
              <Text className="text-sm text-foreground">{r.label}</Text>
              <Text className="text-sm text-foreground">
                ⚔️ <Text className="font-bold">{hit.normal}</Text>
                <Text className="text-muted-foreground"> · 💥 {hit.crit}</Text>
              </Text>
            </View>
          );
        })}
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-foreground">Hábito ruim (−)</Text>
          <Text className="text-sm text-destructive">💚 cura {healAmount(cls, attrs)}</Text>
        </View>
      </View>
      <Text className="text-xs text-muted-foreground">
        Crítico: {Math.round(chance * 100)}% de chance. Ouro por tarefa: 🪙{' '}
        {goldFor(config.gold.task, cls, attrs)}.
        {cls === 'lutador' && game.first_strike_ready
          ? ` O próximo golpe é o primeiro do dia: ×${config.skills.firstStrikeMultiplier}.`
          : ''}{' '}
        Dano = base × (1 + {Math.round(d.perPoint * 100)}% por ponto de Força nas tarefas ou de
        Inteligência nas rotinas + passiva e habilidade) × crítico. Tarefa concluída logo depois de
        criada não dá XP, mas o golpe vale (até {config.antiFarm.dailyQuickDamageCap} de dano por
        dia).
      </Text>
    </Panel>
  );
}

/** Espaços do equipamento e o inventário (tocar equipa/tira). */
export function EquipmentPanel({ game }: { game: GameState }) {
  const items = useItems();
  const equip = useEquipItem();
  const online = useIsOnline();
  const owned = (items.data ?? []).filter((i) => game.inventory.includes(i.key));
  return (
    <Panel
      title="Equipamento"
      right={
        <Link href="/shop" asChild>
          <Pressable accessibilityRole="link" className="min-h-11 justify-center px-2">
            <Text className="text-sm font-semibold text-primary">🛒 Loja</Text>
          </Pressable>
        </Link>
      }
    >
      {SLOTS.map((slot) => {
        const mine = owned.filter((i) => i.slot === slot.key);
        return (
          <View key={slot.key} className="gap-1">
            <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {slot.label}
            </Text>
            {mine.length === 0 ? (
              <Text className="text-sm text-muted-foreground">Nada ainda.</Text>
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
  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={equipped}
      accessibilityLabel={`${item.name} (${RARITY[item.rarity].label})`}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'min-h-11 flex-row items-center gap-2 rounded-full border px-3 active:opacity-70',
        equipped ? 'border-primary bg-primary/10' : RARITY[item.rarity].border,
      )}
    >
      <Text style={{ fontSize: 18, lineHeight: 22 }}>{item.icon}</Text>
      <Text className="text-sm text-foreground">{item.name}</Text>
      {equipped && <Text className="text-xs text-primary">✓</Text>}
    </Pressable>
  );
}

/** Painel com título (cartão das telas de personagem e loja). */
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
    <View className={cn('gap-3 rounded-2xl border border-border bg-card p-4', className)}>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-base font-bold text-foreground" accessibilityRole="header">
          {title}
        </Text>
        {right}
      </View>
      {children}
    </View>
  );
}
