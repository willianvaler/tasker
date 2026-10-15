import { describe, expect, it } from '@jest/globals';

import { applyRep, effectiveReps, readRepeatPlan, restAfterRep, type RepeatPlan } from '../repeat';

// Mesmos casos do supabase/tests/repeticoes.test.sql (log_rep)
const plan: RepeatPlan = { mode: 'sets', total: 3, rest_seconds: 60 };

describe('effectiveReps', () => {
  it('concluída mostra o total', () => expect(effectiveReps(plan, true, 0)).toBe(3));
  it('aberta não passa de total − 1', () => expect(effectiveReps(plan, false, 3)).toBe(2));
  it('sem conta é zero', () => expect(effectiveReps(plan, false, null)).toBe(0));
});

describe('applyRep', () => {
  it('soma uma série', () => expect(applyRep(plan, false, 1, 1)).toEqual({ reps: 2, done: false }));
  it('a última conclui', () =>
    expect(applyRep(plan, false, 2, 1)).toEqual({ reps: 3, done: true }));
  it('concluída não passa do total', () =>
    expect(applyRep(plan, true, 3, 1)).toEqual({ reps: 3, done: true }));
  it('desfazer a última reabre', () =>
    expect(applyRep(plan, true, 0, -1)).toEqual({ reps: 2, done: false }));
  it('desfazer no zero fica no zero', () =>
    expect(applyRep(plan, false, 0, -1)).toEqual({ reps: 0, done: false }));
});

describe('readRepeatPlan', () => {
  it('aceita o formato do banco', () =>
    expect(readRepeatPlan({ mode: 'count', total: 8 })).toEqual({ mode: 'count', total: 8 }));
  it('recusa total fora da faixa', () =>
    expect(readRepeatPlan({ mode: 'sets', total: 0 })).toBeNull());
  it('null é sem plano', () => expect(readRepeatPlan(null)).toBeNull());
});

describe('restAfterRep', () => {
  it('entre séries: o descanso do plano', () =>
    expect(restAfterRep(plan, 1)).toEqual({ seconds: 60, after: false }));
  it('na última, sem descanso ao terminar: nada', () => expect(restAfterRep(plan, 3)).toBeNull());
  it('na última, com descanso ao terminar', () =>
    expect(restAfterRep({ ...plan, rest_after_seconds: 120 }, 3)).toEqual({
      seconds: 120,
      after: true,
    }));
  it('contador não descansa entre as vezes', () =>
    expect(restAfterRep({ mode: 'count', total: 8, rest_seconds: 30 }, 2)).toBeNull());
});
