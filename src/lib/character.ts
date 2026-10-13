import { gamificationConfig as config } from './gamification.config';

// Personagem (D60, D61): classes, atributos e a conta do dano. Quem calcula de verdade é o banco
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

/** HP do boss de um nível (espelho de public.boss_hp_for_level). */
export function bossHpForLevel(level: number) {
  const { hpBase, hpGrowth } = config.boss;
  return Math.round(hpBase * Math.pow(hpGrowth, Math.max(level, 1) - 1));
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
  common: { label: 'Comum', text: 'text-muted-foreground', border: 'border-border' },
  rare: { label: 'Raro', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-500/60' },
  epic: {
    label: 'Épico',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-500/70',
  },
  legendary: {
    label: 'Lendário',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/80',
  },
};

/** Fundo do personagem para cada aura (com par claro/escuro, para os dois temas). */
export const AURA_BG: Record<string, string> = {
  aura_sky: 'bg-sky-100 dark:bg-sky-950',
  aura_forest: 'bg-emerald-100 dark:bg-emerald-950',
  aura_sunset: 'bg-orange-100 dark:bg-orange-950',
  aura_night: 'bg-indigo-200 dark:bg-indigo-950',
  aura_gold: 'bg-amber-200 dark:bg-amber-900',
  aura_void: 'bg-zinc-800 dark:bg-black',
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
