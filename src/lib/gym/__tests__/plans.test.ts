import { describe, expect, it } from '@jest/globals';

import { GYM_PLANS, PLAN_EXERCISES, planDaysPerWeek, planItemToTask } from '../plans';
import { PROGRESSION_RULES } from '../progression';

declare const require: (id: string) => unknown;
const fs = require('fs') as { readFileSync: (p: string, e: string) => string };
const catalog = new Set(
  (JSON.parse(fs.readFileSync('data/exercicios/base.json', 'utf8')) as { id: string }[]).map(
    (e) => e.id,
  ),
);

describe('planos prontos (AC12.1)', () => {
  it('todo exercício existe no catálogo', () => {
    expect(PLAN_EXERCISES.filter((id) => !catalog.has(id))).toEqual([]);
  });

  it('ids únicos, regra conhecida, dias válidos e treinos sem dia repetido', () => {
    expect(new Set(GYM_PLANS.map((p) => p.id)).size).toBe(GYM_PLANS.length);
    for (const plan of GYM_PLANS) {
      expect(PROGRESSION_RULES).toContain(plan.progression);
      const days = plan.workouts.flatMap((w) => w.days);
      expect(new Set(days).size).toBe(days.length);
      for (const d of days) expect(d >= 0 && d <= 6).toBe(true);
      for (const w of plan.workouts) {
        expect(w.items.length).toBeGreaterThan(0);
        for (const item of w.items) expect(!!item.reps !== !!item.sec).toBe(true);
      }
    }
  });

  it('os pedidos pelo dono estão lá', () => {
    expect(GYM_PLANS.map((p) => p.id)).toEqual([
      'fullbody3',
      'abc',
      'abcd',
      'upperlower',
      'ppl',
      'fivebyfive',
      'greyskull',
      'home',
    ]);
    expect(planDaysPerWeek(GYM_PLANS.find((p) => p.id === 'upperlower')!)).toBe(4);
    expect(planDaysPerWeek(GYM_PLANS.find((p) => p.id === 'ppl')!)).toBe(6);
  });

  it('item por repetição vira séries com descanso; por tempo, séries cronometradas', () => {
    expect(planItemToTask({ exercise: 'x', sets: 3, reps: 10, rest: 90 })).toEqual({
      repeatPlan: { mode: 'sets', total: 3, rest_seconds: 90 },
      meta: { sets: 3, reps: 10 },
      timed: false,
    });
    expect(planItemToTask({ exercise: 'x', sets: 3, sec: 30, rest: 45 })).toEqual({
      repeatPlan: { mode: 'timed', total: 3, duration_seconds: 30, rest_seconds: 45 },
      meta: { sets: 3 },
      timed: true,
    });
  });
});
