import { describe, expect, it } from '@jest/globals';

import {
  defaultStep,
  judgeSession,
  prescribe,
  readCoachPlan,
  type Plan,
  type Session,
} from '../progression';

const session = (
  reps: number[],
  weight: number | null = 40,
  targetReps = 10,
  targetSets = reps.length,
): Session => ({
  day: 'd',
  targetSets,
  sets: reps.map((r) => ({ weight, reps: r, targetReps })),
});
const plan: Plan = { weight: 40, unit: 'kg', reps: 10, sets: 3 };

describe('degrau padrão', () => {
  it('em cima 2,5 kg, pernas e costas 5 kg; em lb 5/10', () => {
    expect(defaultStep('chest', 'kg')).toBe(2.5);
    expect(defaultStep('upper legs', 'kg')).toBe(5);
    expect(defaultStep('back', 'lb')).toBe(10);
    expect(defaultStep(null, 'lb')).toBe(5);
  });
});

describe('leitura honesta da sessão', () => {
  it('série que faltou ou com menos reps é falha', () => {
    expect(judgeSession('linear', session([10, 10, 10]))).toBe('top');
    expect(judgeSession('linear', session([10, 10, 9]))).toBe('fail');
    expect(judgeSession('linear', session([10, 10], 40, 10, 3))).toBe('fail');
    expect(judgeSession('double', session([12, 12, 12]))).toBe('top');
    expect(judgeSession('double', session([12, 10, 9]))).toBe('ok');
    expect(judgeSession('double', session([12, 10, 7]))).toBe('fail');
  });
});

describe('prescrição', () => {
  it('nenhuma e primeira vez mantêm', () => {
    expect(prescribe('off', plan, [session([10, 10, 10])], 2.5).kind).toBe('off');
    const first = prescribe('linear', plan, [], 2.5);
    expect(first).toMatchObject({ kind: 'first', weight: 40, reps: 10 });
  });

  it('linear: fez tudo, sobe um degrau e diz por quê', () => {
    expect(prescribe('linear', plan, [session([10, 10, 10])], 2.5)).toEqual({
      weight: 42.5,
      reps: 10,
      seconds: null,
      kind: 'up',
      why: { key: 'progression.up', vars: { step: 2.5, done: '3×10', min: 8 } },
    });
  });

  it('linear: falhou, mantém; três falhas seguidas, deload de 10%', () => {
    const fail = session([10, 9, 8]);
    expect(prescribe('linear', plan, [fail], 2.5)).toMatchObject({
      kind: 'hold',
      weight: 40,
      why: { key: 'progression.holdFail', vars: { done: '10/9/8' } },
    });
    expect(prescribe('linear', plan, [fail, fail, fail], 2.5)).toMatchObject({
      kind: 'deload',
      weight: 35,
      why: { key: 'progression.deload', vars: { fails: 3, weight: 35 } },
    });
    // A falha antiga separada por um acerto não soma
    expect(prescribe('linear', plan, [fail, fail, session([10, 10, 10]), fail], 2.5).kind).toBe(
      'hold',
    );
  });

  it('dupla: na faixa repete a carga com mais uma rep; no topo sobe e volta ao começo', () => {
    expect(prescribe('double', plan, [session([10, 9, 9])], 2.5)).toMatchObject({
      kind: 'hold',
      weight: 40,
      reps: 10,
    });
    expect(prescribe('double', plan, [session([12, 12, 12])], 2.5)).toMatchObject({
      kind: 'up',
      weight: 42.5,
      reps: 8,
      why: { key: 'progression.upRange' },
    });
  });

  it('Greyskull: dobro da meta na última dobra o degrau; uma falha já é deload', () => {
    const gs: Plan = { weight: 60, unit: 'kg', reps: 5, sets: 3 };
    expect(prescribe('greyskull', gs, [session([5, 5, 7], 60, 5)], 2.5)).toMatchObject({
      kind: 'up',
      weight: 62.5,
    });
    expect(prescribe('greyskull', gs, [session([5, 5, 10], 60, 5)], 2.5)).toMatchObject({
      kind: 'up',
      weight: 65,
      why: { key: 'progression.upDouble' },
    });
    expect(prescribe('greyskull', gs, [session([5, 5, 4], 60, 5)], 2.5)).toMatchObject({
      kind: 'deload',
      weight: 55,
    });
  });

  it('mais tempo: segurou todas, +5 s', () => {
    const time: Plan = { weight: null, unit: 'kg', reps: null, seconds: 45, sets: 3 };
    const held: Session = {
      day: 'd',
      targetSets: 3,
      sets: [45, 50, 45].map((s) => ({ weight: null, reps: null, seconds: s, targetSeconds: 45 })),
    };
    expect(prescribe('time', time, [held], 2.5)).toMatchObject({ kind: 'up', seconds: 50 });
    const short = { ...held, sets: [...held.sets.slice(0, 2), { ...held.sets[2], seconds: 30 }] };
    expect(prescribe('time', time, [short], 2.5)).toMatchObject({ kind: 'hold', seconds: 45 });
  });

  it('peso do corpo progride em repetições', () => {
    const bw: Plan = { weight: null, unit: 'kg', reps: 10, sets: 3 };
    expect(prescribe('linear', bw, [session([10, 10, 10], null)], 2.5)).toMatchObject({
      kind: 'up',
      weight: null,
      reps: 11,
    });
  });

  it('carga arredondada ao degrau', () => {
    const odd: Plan = { weight: 41, unit: 'kg', reps: 10, sets: 3 };
    expect(prescribe('linear', odd, [session([10, 10, 10], 41)], 2.5).weight).toBe(42.5);
  });
});

describe('plano do treinador (AC13.2)', () => {
  const id = 't1';
  it('lê do objeto e do texto JSON do aparelho', () => {
    const plan = { t1: { progression: 'linear', weight: '40kg' } };
    expect(readCoachPlan(plan, id)).toEqual({ progression: 'linear', weight: '40kg' });
    expect(readCoachPlan(JSON.stringify(plan), id)).toEqual({
      progression: 'linear',
      weight: '40kg',
    });
  });
  it('só a carga, só a regra, ou nada', () => {
    expect(readCoachPlan({ t1: { weight: '20kg' } }, id)).toEqual({
      progression: null,
      weight: '20kg',
    });
    expect(readCoachPlan({ t1: { progression: 'off' } }, id)).toEqual({
      progression: 'off',
      weight: null,
    });
    expect(readCoachPlan({ t1: { progression: 'turbo' } }, id)).toBeNull();
    expect(readCoachPlan({}, id)).toBeNull();
    expect(readCoachPlan('{quebrado', id)).toBeNull();
    expect(readCoachPlan(null, id)).toBeNull();
  });
  it('a carga inicial vale no primeiro treino; depois a regra segue o diário', () => {
    const start: Plan = { ...plan, weight: 30 };
    expect(prescribe('linear', start, [], 2.5)).toMatchObject({ weight: 30, kind: 'first' });
    expect(prescribe('off', start, [session([10, 10, 10])], 2.5)).toMatchObject({ weight: 30 });
    expect(prescribe('linear', start, [session([10, 10, 10], 30)], 2.5)).toMatchObject({
      weight: 32.5,
      kind: 'up',
    });
  });
});
