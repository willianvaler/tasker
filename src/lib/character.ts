import { gamificationConfig as config } from './gamification.config';

// Personagem: classes, atributos e a conta do dano. Quem calcula de verdade é o banco
// (public._attack, _gold_for, habit_tick); estas funções são o espelho para a ficha mostrar os
// números, com os mesmos casos de teste do pgTAP fase7_rpg.

export type ClassKey = keyof typeof config.classes;
export type AttrKey = 'str' | 'agi' | 'int' | 'con';
export type Attributes = Record<AttrKey, number>;
export type DamageCategory = 'task' | 'routine';

export const ATTRIBUTES: {
  key: AttrKey;
  label: string;
  short: string;
  icon: string;
  effect: string;
}[] = [
  {
    key: 'str',
    label: 'Força',
    short: 'FOR',
    icon: '💪',
    effect: `+${pct(config.damage.perPoint)} de dano em tarefas por ponto`,
  },
  {
    key: 'int',
    label: 'Inteligência',
    short: 'INT',
    icon: '🧠',
    effect: `+${pct(config.damage.perPoint)} de dano em hábitos e rotinas por ponto`,
  },
  {
    key: 'agi',
    label: 'Agilidade',
    short: 'AGI',
    icon: '🌀',
    effect: `+${pct(config.damage.critPerAgi)} de chance de crítico por ponto (até ${pct(config.damage.critMax)})`,
  },
  {
    key: 'con',
    label: 'Constituição',
    short: 'CON',
    icon: '🛡️',
    effect: `+${pct(config.gold.perCon)} de ouro e −${pct(config.attributes.healReducePerCon)} na cura dos hábitos ruins por ponto`,
  },
];

const s = config.skills;

export const CLASSES: Record<
  ClassKey,
  {
    name: string;
    icon: string;
    /** Corpo do personagem na ficha */
    figure: string;
    blurb: string;
    passive: { name: string; text: string };
    active: { name: string; text: string };
  }
> = {
  lutador: {
    name: 'Lutador',
    icon: '⚔️',
    figure: '🤺',
    blurb: 'Força bruta contra a lista de tarefas.',
    passive: {
      name: 'Primeiro golpe',
      text: `O primeiro golpe do dia causa dano ×${s.firstStrikeMultiplier}.`,
    },
    active: { name: 'Fúria', text: `Hoje, +${pct(s.furyBonus)} de dano em tarefas.` },
  },
  mago: {
    name: 'Mago',
    icon: '🔮',
    figure: '🧙',
    blurb: 'Constância vira poder: hábitos e rotinas são o seu forte.',
    passive: {
      name: 'Foco arcano',
      text: `+${pct(s.streakFocusPerDay)} de dano por dia de sequência (até +${pct(s.streakFocusMax)}).`,
    },
    active: {
      name: 'Tempestade arcana',
      text: `Hoje, +${pct(s.stormBonus)} de dano em hábitos e rotinas.`,
    },
  },
  arqueiro: {
    name: 'Arqueiro',
    icon: '🏹',
    figure: '🧝',
    blurb: 'Poucos golpes, muito certeiros.',
    passive: {
      name: 'Olho de águia',
      text: `Críticos causam ×${fmt(s.archerCritMultiplier)} (em vez de ×${config.damage.critMultiplier}).`,
    },
    active: { name: 'Mira certeira', text: `Hoje, +${pct(s.aimCritBonus)} de chance de crítico.` },
  },
  paladino: {
    name: 'Paladino',
    icon: '🛡️',
    figure: '🦸',
    blurb: 'Resiste aos maus hábitos e protege o clã.',
    passive: {
      name: 'Proteção',
      text: `Hábitos ruins curam o boss ${pct(s.paladinHealReduce)} a menos.`,
    },
    active: { name: 'Bênção', text: `Hoje, +${pct(s.blessingBonus)} de dano em tudo.` },
  },
  ladino: {
    name: 'Ladino',
    icon: '🗡️',
    figure: '🥷',
    blurb: 'Ágil, esperto e sempre com o bolso cheio.',
    passive: { name: 'Mão leve', text: `+${pct(s.rogueGoldBonus)} de ouro.` },
    active: {
      name: 'Emboscada',
      text: `Hoje, tarefas atrasadas causam dano ×${s.ambushMultiplier}.`,
    },
  },
};

export const CLASS_KEYS = Object.keys(CLASSES) as ClassKey[];

export function isClassKey(value: unknown): value is ClassKey {
  return typeof value === 'string' && value in CLASSES;
}

/** Atributos totais: base + bônus da classe + pontos distribuídos (espelho de character_attributes). */
export function totalAttributes(cls: ClassKey | null, allocated: Attributes): Attributes {
  const bonus = cls ? config.classes[cls] : { str: 0, agi: 0, int: 0, con: 0 };
  const base = config.attributes.base;
  return {
    str: base + bonus.str + allocated.str,
    agi: base + bonus.agi + allocated.agi,
    int: base + bonus.int + allocated.int,
    con: base + bonus.con + allocated.con,
  };
}

/** Peso da tarefa no golpe (M3): espelho de public.weight_factor. */
export function weightFactor(weight: number | null | undefined) {
  return 1 + config.damage.weightStep * ((weight ?? 1) - 1);
}

/** HP do boss semanal de um nível (espelho de public.boss_hp_for_level). */
export function bossHpForLevel(level: number) {
  const { hpBase, hpGrowth } = config.boss;
  return Math.round(hpBase * Math.pow(hpGrowth, Math.max(level, 1) - 1));
}

/** HP do boss diário de um nível, com teto (espelho de public.daily_boss_hp, O1) */
export function dailyBossHp(level: number) {
  const { hpBase, hpGrowth, hpMaxFactor } = config.dailyBoss;
  return Math.round(
    Math.min(hpBase * Math.pow(hpGrowth, Math.max(level, 1) - 1), hpBase * hpMaxFactor),
  );
}

/** Chance de crítico (0 a 1). */
export function critChance(cls: ClassKey | null, attrs: Attributes, skillActive = false) {
  const aim = skillActive && cls === 'arqueiro' ? s.aimCritBonus : 0;
  return Math.min(config.damage.critMax, config.damage.critPerAgi * attrs.agi + aim);
}

/**
 * Dano de um golpe sem e com crítico (espelho de public._attack, sem o sorteio).
 * `firstStrike`: é o primeiro golpe do dia (passiva do lutador). `overdue`: tarefa atrasada (Emboscada).
 */
export function hitDamage(
  base: number,
  category: DamageCategory,
  cls: ClassKey | null,
  attrs: Attributes,
  opts: { streak?: number; skillActive?: boolean; firstStrike?: boolean; overdue?: boolean } = {},
) {
  const { streak = 0, skillActive = false, firstStrike = false, overdue = false } = opts;
  let mult = 1 + config.damage.perPoint * (category === 'task' ? attrs.str : attrs.int);
  if (cls === 'mago') mult += Math.min(s.streakFocusMax, s.streakFocusPerDay * streak);
  if (skillActive && cls) {
    if (cls === 'lutador' && category === 'task') mult += s.furyBonus;
    if (cls === 'mago' && category === 'routine') mult += s.stormBonus;
    if (cls === 'paladino') mult += s.blessingBonus;
  }
  if (cls === 'lutador' && firstStrike) mult *= s.firstStrikeMultiplier;
  if (skillActive && cls === 'ladino' && category === 'task' && overdue) mult *= s.ambushMultiplier;
  const critMult = cls === 'arqueiro' ? s.archerCritMultiplier : config.damage.critMultiplier;
  return {
    normal: Math.max(1, roundHalfUp(base * mult)),
    crit: Math.max(1, roundHalfUp(base * mult * critMult)),
  };
}

/** Quanto um "−" num hábito ruim cura o boss (espelho do habit_tick). */
export function healAmount(cls: ClassKey | null, attrs: Attributes) {
  const { healReducePerCon, healReduceMax } = config.attributes;
  const reduce = Math.min(healReduceMax, healReducePerCon * attrs.con);
  const paladin = cls === 'paladino' ? 1 - s.paladinHealReduce : 1;
  return roundHalfUp(config.damage.habitMinusHeal * (1 - reduce) * paladin);
}

/** Ouro de uma conclusão (espelho de public._gold_for). */
export function goldFor(base: number, cls: ClassKey | null, attrs: Attributes) {
  if (base <= 0) return 0;
  const mult = 1 + config.gold.perCon * attrs.con + (cls === 'ladino' ? s.rogueGoldBonus : 0);
  return roundHalfUp(base * mult);
}

// ------------------------------------------------------------
// Itens
// ------------------------------------------------------------

export type Slot = 'head' | 'hand' | 'pet' | 'aura' | 'title';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const SLOTS: { key: Slot; label: string }[] = [
  { key: 'head', label: 'Cabeça' },
  { key: 'hand', label: 'Mão' },
  { key: 'pet', label: 'Companheiro' },
  { key: 'aura', label: 'Aura' },
  { key: 'title', label: 'Título' },
];

export const RARITY: Record<Rarity, { label: string; text: string; border: string }> = {
  common: { label: 'Comum', text: 'text-ink-muted', border: 'border-line' },
  rare: { label: 'Raro', text: 'text-ok', border: 'border-ok/60' },
  epic: {
    label: 'Épico',
    text: 'text-warn',
    border: 'border-warn/70',
  },
  legendary: {
    label: 'Lendário',
    text: 'text-accent',
    border: 'border-accent/80',
  },
};

/** Fundo do personagem para cada aura, só com tokens do tema. */
export const AURA_BG: Record<string, string> = {
  aura_sky: 'bg-wash',
  aura_forest: 'bg-ok/15',
  aura_sunset: 'bg-accent-soft',
  aura_night: 'bg-ink/10',
  aura_gold: 'bg-warn/20',
  aura_void: 'bg-ink/80',
};

// ------------------------------------------------------------

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function fmt(value: number) {
  return String(value).replace('.', ',');
}

/** round() do Postgres em numeric: metade para longe do zero. */
function roundHalfUp(value: number) {
  return Math.sign(value) * Math.round(Math.abs(value) + 1e-9);
}
