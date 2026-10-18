import { z } from 'zod';

// Conquistas (V4 §2, D180): raridade, categoria, séries e o progresso até a próxima. Funções
// puras; o catálogo e a concessão são do servidor (my_achievements, _check_achievements).

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

export const CATEGORIES = [
  'tasks',
  'streak',
  'bosses',
  'levels',
  'character',
  'habits',
  'projects',
  'special',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const achievementItemSchema = z.object({
  key: z.string(),
  icon: z.string().nullable(),
  rarity: z.enum(RARITIES),
  category: z.enum(CATEGORIES),
  series: z.string().nullable(),
  goal: z.number().nullable(),
  secret: z.boolean(),
  unlocked_at: z.string().nullable(),
  pct: z.number().nullable(),
});
export type AchievementItem = z.infer<typeof achievementItemSchema>;

export const myAchievementsSchema = z.object({
  items: z.array(achievementItemSchema),
  progress: z.record(z.string(), z.number()),
});
export type MyAchievements = z.infer<typeof myAchievementsSchema>;

/** Para ordenar: lendária por último (ou primeiro, invertendo). */
export const rarityRank = (rarity: Rarity) => RARITIES.indexOf(rarity);

/**
 * Próxima conquista de cada série: a menor meta ainda não conquistada, com quanto falta.
 * Ex.: tarefas 140 → { key: 'tasks_500', value: 140, goal: 500, ratio: 0.28 }.
 */
export function nextInSeries(items: readonly AchievementItem[], progress: Record<string, number>) {
  const next = new Map<string, { key: string; value: number; goal: number; ratio: number }>();
  for (const item of items) {
    if (!item.series || item.goal == null || item.unlocked_at) continue;
    const current = next.get(item.series);
    if (current && current.goal <= item.goal) continue;
    const value = Math.max(0, progress[item.series] ?? 0);
    next.set(item.series, {
      key: item.key,
      value,
      goal: item.goal,
      ratio: Math.min(1, value / item.goal),
    });
  }
  return next;
}

export type AchievementFilter = {
  rarity?: Rarity | null;
  category?: Category | null;
  /** 'unlocked' só as conquistadas; 'locked' só as que faltam */
  state?: 'unlocked' | 'locked' | null;
};

export function filterAchievements(items: readonly AchievementItem[], filter: AchievementFilter) {
  return items.filter(
    (item) =>
      (!filter.rarity || item.rarity === filter.rarity) &&
      (!filter.category || item.category === filter.category) &&
      (!filter.state || (filter.state === 'unlocked') === !!item.unlocked_at),
  );
}
