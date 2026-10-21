import { describe, expect, it } from '@jest/globals';

import { heatLevel, minutesByDay, trainingTotals, yearGrid } from '../heatmap';
import {
  muscleLevel,
  muscleWork,
  setsWork,
  slugsOf,
  untrained,
  weeklyVolume,
  workLevels,
} from '../muscle-volume';

describe('mapa de calor', () => {
  it('minutos do dia: cada bloco da primeira à última série, mais a última', () => {
    expect(
      minutesByDay(
        [
          { performed_at: '2026-10-19T12:00:00Z' },
          { performed_at: '2026-10-19T12:40:00Z' },
          { performed_at: '2026-10-20T02:00:00Z' }, // 23h do dia 19 em São Paulo
          { performed_at: '2026-10-20T12:00:00Z' },
        ],
        'America/Sao_Paulo',
      ),
    ).toEqual({ '2026-10-19': 46, '2026-10-20': 3 });
  });

  it('níveis', () => {
    expect([0, 10, 30, 60, 90, 200].map(heatLevel)).toEqual([0, 1, 2, 3, 4, 4]);
    expect(heatLevel(undefined)).toBe(0);
  });

  it('grade: semanas de segunda a domingo, futuro vazio', () => {
    // 2026-10-20 é terça
    const grid = yearGrid('2026-10-20', { '2026-10-19': 45 }, 2);
    expect(grid).toHaveLength(2);
    expect(grid[0][0]?.day).toBe('2026-10-12');
    expect(grid[1][0]).toEqual({ day: '2026-10-19', minutes: 45, level: 2 });
    expect(grid[1][1]?.day).toBe('2026-10-20');
    expect(grid[1][2]).toBeNull();
  });

  it('totais do período', () => {
    expect(
      trainingTotals(
        { '2026-10-01': 60, '2026-10-08': 30, '2026-09-01': 50 },
        '2026-09-24',
        '2026-10-21',
      ),
    ).toEqual({ days: 2, minutes: 90, perWeek: 0.5 });
  });
});

describe('músculos', () => {
  it('nomes da base para o desenho', () => {
    expect(slugsOf('shoulders')).toEqual(['deltoids', 'rotatorCuff']);
    expect(slugsOf('cardio')).toEqual([]);
  });

  it('trabalho: alvo vale 1, sinergista ½, aquecimento fora, só no período', () => {
    const work = muscleWork(
      [
        {
          performed_at: '2026-10-19T12:00:00Z',
          target: 'chest',
          secondary: ['triceps', 'shoulders'],
        },
        { performed_at: '2026-10-19T12:01:00Z', target: 'chest', secondary: ['triceps'] },
        { performed_at: '2026-10-19T12:02:00Z', target: 'chest', secondary: [], warmup: true },
        { performed_at: '2026-10-01T12:00:00Z', target: 'quads', secondary: [] },
      ],
      'UTC',
      '2026-10-13',
    );
    expect(work).toEqual({ chest: 2, triceps: 1, deltoids: 0.5, rotatorCuff: 0.5 });
    expect(untrained(work)).toContain('quadriceps');
    expect(untrained(work)).not.toContain('chest');
    expect([muscleLevel(2, 2), muscleLevel(0.5, 2), muscleLevel(undefined, 2)]).toEqual([4, 1, 0]);
  });

  it('volume e esforço por semana', () => {
    expect(
      weeklyVolume(
        [
          {
            performed_at: '2026-10-13T12:00:00Z',
            weight_kg: 40,
            reps: 10,
            effort: 2,
            effort_scale: 'rir',
          },
          {
            performed_at: '2026-10-14T12:00:00Z',
            weight_kg: 40,
            reps: 10,
            effort: 9,
            effort_scale: 'rpe',
          },
          { performed_at: '2026-10-14T12:05:00Z', weight_kg: 20, reps: 10, warmup: true },
          { performed_at: '2026-10-20T12:00:00Z', weight_kg: null, reps: 15 },
        ],
        'UTC',
        'rpe',
      ),
    ).toEqual([
      { week: '2026-W42', volumeKg: 800, sets: 2, effort: 8.5 },
      { week: '2026-W43', volumeKg: 0, sets: 1, effort: null },
    ]);
  });
});

describe('músculos de um treino (AC8.6)', () => {
  it('séries no alvo, metade no sinergista, sem repetir a parte', () => {
    const work = setsWork([
      { target: 'chest', secondary: ['triceps', 'shoulders'], sets: 3 },
      { target: 'triceps', secondary: [], sets: 2 },
      { target: 'quads', secondary: [], sets: 0 },
    ]);
    expect(work).toEqual({ chest: 3, triceps: 3.5, deltoids: 1.5, rotatorCuff: 1.5 });
  });
  it('níveis relativos ao mais trabalhado', () =>
    expect(workLevels({ chest: 4, biceps: 1 })).toEqual({ chest: 4, biceps: 1 }));
  it('sem nada, sem níveis', () => expect(workLevels({})).toEqual({}));
});
