import { describe, expect, it } from '@jest/globals';

import {
  filterAchievements,
  nextInSeries,
  rarityRank,
  type AchievementItem,
} from '../achievements';

const item = (over: Partial<AchievementItem>): AchievementItem => ({
  key: 'x',
  icon: '⭐',
  rarity: 'common',
  category: 'tasks',
  series: null,
  goal: null,
  secret: false,
  unlocked_at: null,
  pct: null,
  ...over,
});

const items = [
  item({ key: 'tasks_10', series: 'tasks', goal: 10, unlocked_at: '2026-10-01' }),
  item({ key: 'tasks_100', series: 'tasks', goal: 100, rarity: 'uncommon' }),
  item({ key: 'tasks_500', series: 'tasks', goal: 500, rarity: 'rare' }),
  item({ key: 'streak_3', series: 'streak', goal: 3, category: 'streak' }),
  item({ key: 'night_owl', category: 'special', secret: true }),
];

describe('nextInSeries', () => {
  it('a próxima é a menor meta que falta, com o quanto já foi', () => {
    const next = nextInSeries(items, { tasks: 40, streak: 5 });
    expect(next.get('tasks')).toEqual({ key: 'tasks_100', value: 40, goal: 100, ratio: 0.4 });
  });
  it('passou da meta mas o servidor ainda não concedeu: barra cheia', () => {
    expect(nextInSeries(items, { streak: 5 }).get('streak')?.ratio).toBe(1);
  });
  it('sem número da série conta zero; série toda conquistada some', () => {
    const done = items.map((i) => (i.series === 'tasks' ? { ...i, unlocked_at: 'x' } : i));
    const next = nextInSeries(done, {});
    expect(next.has('tasks')).toBe(false);
    expect(next.get('streak')?.value).toBe(0);
  });
});

describe('filterAchievements', () => {
  it('por raridade, categoria e estado', () => {
    expect(filterAchievements(items, { rarity: 'rare' }).map((i) => i.key)).toEqual(['tasks_500']);
    expect(filterAchievements(items, { category: 'special' }).map((i) => i.key)).toEqual([
      'night_owl',
    ]);
    expect(filterAchievements(items, { state: 'unlocked' }).map((i) => i.key)).toEqual([
      'tasks_10',
    ]);
    expect(filterAchievements(items, {})).toHaveLength(5);
  });
});

it('raridade em ordem crescente', () => {
  expect(rarityRank('common')).toBeLessThan(rarityRank('legendary'));
});
