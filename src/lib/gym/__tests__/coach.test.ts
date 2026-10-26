import { describe, expect, it } from '@jest/globals';

import { coachSummary, planAdherence, progressMetric, stagnation, type CoachSet } from '../coach';

const TZ = 'America/Sao_Paulo';

const set = (day: string, extra: Partial<CoachSet> = {}): CoachSet => ({
  task_id: 't1',
  exercise_id: 'supino',
  exercise_name: 'Supino',
  set_index: 1,
  weight_kg: 40,
  reps: 10,
  duration_seconds: null,
  distance_m: null,
  warmup: false,
  performed_at: `${day}T15:00:00Z`,
  records: [],
  ...extra,
});

describe('stagnation', () => {
  const s = (values: number[]) => values.map((value, i) => ({ day: `2026-10-0${i + 1}`, value }));

  it('três sessões sem passar do melhor de antes', () => {
    expect(stagnation(s([50, 60, 60, 58, 60]))).toEqual({
      since: '2026-10-03',
      sessions: 3,
      best: 60,
    });
  });

  it('passou numa das três: não estagnou', () => {
    expect(stagnation(s([50, 60, 60, 61, 60]))).toBeNull();
  });

  it('precisa de uma sessão antes das três', () => {
    expect(stagnation(s([60, 60, 60]))).toBeNull();
    expect(stagnation(s([60, 60, 60, 60]))).not.toBeNull();
  });
});

describe('progressMetric', () => {
  it('1RM com carga; repetições no peso do corpo; tempo; distância', () => {
    expect(progressMetric([set('2026-10-01')])).toBe('one_rm');
    expect(progressMetric([set('2026-10-01', { weight_kg: null, reps: 12 })])).toBe('reps');
    expect(
      progressMetric([set('2026-10-01', { weight_kg: null, reps: null, duration_seconds: 60 })]),
    ).toBe('duration');
    expect(
      progressMetric([set('2026-10-01', { weight_kg: null, reps: null, distance_m: 5000 })]),
    ).toBe('distance');
  });
});

describe('coachSummary', () => {
  it('por exercício: melhor 1RM, recordes, volume recente e estagnação; aquecimento fora', () => {
    const sets = [
      set('2026-09-01', { weight_kg: 80, reps: 1 }),
      set('2026-10-10', { weight_kg: 60, reps: 10, records: ['volume'] }),
      set('2026-10-12', { weight_kg: 60, reps: 9 }),
      set('2026-10-14', { weight_kg: 60, reps: 8 }),
      set('2026-10-16', { weight_kg: 100, reps: 5, warmup: true }),
      set('2026-10-16', { weight_kg: 60, reps: 10 }),
      set('2026-10-15', {
        task_id: 't2',
        exercise_id: null,
        exercise_name: 'Prancha',
        weight_kg: null,
        reps: null,
        duration_seconds: 60,
      }),
    ];
    const summary = coachSummary(sets, TZ, '2026-10-20');
    expect(summary.exercises.map((e) => e.name)).toEqual(['Supino', 'Prancha']);
    const supino = summary.exercises[0];
    // 60 × (1 + 10/30) = 80: as últimas três não passaram do 80 do dia 1º/9
    expect(supino.best1Rm).toEqual({ oneRm: 80, weightKg: 60, reps: 10 });
    expect(supino.stagnation).toEqual({ since: '2026-10-12', sessions: 3, best: 80 });
    expect(supino.sessions).toBe(5);
    expect(supino.records).toBe(1);
    // Só os últimos 28 dias, sem o aquecimento
    expect(supino.recentVolumeKg).toBe(60 * (10 + 9 + 8 + 10));
    expect(summary.exercises[1].metric).toBe('duration');
    expect(summary.records).toBe(1);
    expect(summary.days).toEqual([
      '2026-09-01',
      '2026-10-10',
      '2026-10-12',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
    ]);
  });

  it('progredindo: sem alerta', () => {
    const sets = ['2026-10-01', '2026-10-03', '2026-10-05', '2026-10-07'].map((day, i) =>
      set(day, { weight_kg: 40 + i * 2.5 }),
    );
    expect(coachSummary(sets, TZ, '2026-10-20').exercises[0].stagnation).toBeNull();
  });
});

describe('planAdherence', () => {
  // 2026-10-20 é terça. Plano: segunda, quarta e sexta
  const plan = [1, 3, 5];

  it('sem plano, nada', () => {
    expect(planAdherence(['2026-10-19'], [], '2026-10-20')).toBeNull();
  });

  it('conta os dias previstos dos últimos 28 dias e os treinados até o previsto da semana', () => {
    // De 23/9 (quarta) a 20/10: 4 semanas inteiras de seg/qua/sex (12) menos a segunda 21/9
    // (fora) mais a segunda 19/10 (dentro) = 12 previstos
    const result = planAdherence(
      [
        '2026-09-23', // qua
        '2026-09-24', // qui (outro dia da semana vale)
        '2026-09-25', // sex
        '2026-09-26', // sáb: passa do previsto da semana (qua e sex), não conta
        '2026-10-05',
        '2026-10-19',
        '2026-08-01', // fora do período
      ],
      plan,
      '2026-10-20',
    );
    expect(result).toEqual({ done: 4, expected: 12 });
  });
});
