import { describe, expect, it } from '@jest/globals';

import type { Task } from '../queries/tasks';
import {
  adjustSetWeight,
  adjustWeight,
  formatRest,
  groupsLabel,
  restBetweenExercises,
  setGroups,
  setPrescription,
  parseRest,
  planFromSets,
  nextPending,
  setVolume,
  workoutElapsed,
  workoutItems,
  workoutProgress,
} from '../workout';

const task = (id: string, extra: Partial<Task> = {}) =>
  ({
    id,
    parent_task_id: null,
    position: Number(id.replace(/\D/g, '')) || 0,
    status: 'todo',
    repeat_plan: null,
    ...extra,
  }) as Task;

describe('workoutItems', () => {
  const tasks = [
    task('t2', { repeat_plan: { mode: 'sets', total: 3 } }),
    task('t1'),
    task('t3'),
    task('t4', { parent_task_id: 't3', position: 1 }),
    task('t5', { parent_task_id: 't3', position: 2, status: 'done' }),
  ];
  const items = workoutItems(tasks, { t2: 1 });
  it('na ordem da lista, mãe vira as filhas', () =>
    expect(items.map((i) => i.task.id)).toEqual(['t1', 't2', 't4', 't5']));
  it('sem plano vale uma vez', () =>
    expect(items[0]).toMatchObject({ repeats: false, plan: { total: 1 } }));
  it('a conta vem do andamento', () => expect(items[1].reps).toBe(1));
  it('progresso por série', () => expect(workoutProgress(items)).toEqual({ done: 2, total: 6 }));
  it('próximo a fazer pula os feitos e os pulados, e dá a volta', () => {
    expect(nextPending(items, 0, [])).toBe(0);
    expect(nextPending(items, 0, ['t1'])).toBe(1);
    expect(nextPending(items, 3, [])).toBe(0);
    expect(nextPending(items, 0, ['t1', 't2', 't4'])).toBe(-1);
  });
});

describe('carga', () => {
  it.each([
    ['20kg', 2.5, '22,5kg'],
    ['20.5kg', 2, '22.5kg'],
    ['12,5kg', 2.5, '15kg'],
    ['12,5kg', 1, '13,5kg'],
    ['2kg', -5, '0kg'],
    [undefined, 2.5, '2,5kg'],
  ])('%s %d → %s', (weight, step, result) => expect(adjustWeight(weight, step)).toBe(result));
  it('volume = carga × reps', () => expect(setVolume({ weight: '42,5kg', reps: 10 })).toBe(425));
  it('sem carga, zero', () => expect(setVolume({ reps: 10 })).toBe(0));
});

it('tempo sem as pausas', () =>
  expect(workoutElapsed({ startedAt: 0, pausedMs: 30_000, pausedAt: null }, 90_000)).toBe(60));

it('em inglês, ponto', () => expect(adjustWeight('20lb', 2.5, false)).toBe('22.5lb'));

describe('descanso no painel', () => {
  it('lê o descanso digitado', () => {
    expect(parseRest('90')).toBe(90);
    expect(parseRest('90s')).toBe(90);
    expect(parseRest('1:30')).toBe(90);
    expect(parseRest('2min')).toBe(120);
    expect(parseRest(' 2 m ')).toBe(120);
    expect(parseRest('')).toBeNull();
    expect(parseRest('abc')).toBeNull();
    expect(parseRest('0')).toBeNull();
    expect(parseRest('61:00')).toBeNull();
  });

  it('mostra o descanso', () => {
    expect(formatRest(45)).toBe('45s');
    expect(formatRest(90)).toBe('1:30');
    expect(formatRest(120)).toBe('2:00');
    expect(formatRest(null)).toBe('');
  });

  it('séries viram o plano, com o descanso', () => {
    expect(planFromSets(null, 3, null)).toEqual({ mode: 'sets', total: 3, rest_seconds: 60 });
    expect(planFromSets(null, 4, 90)).toEqual({ mode: 'sets', total: 4, rest_seconds: 90 });
    const plan = { mode: 'sets' as const, total: 3, rest_seconds: 45, rest_after_seconds: 120 };
    expect(planFromSets(plan, 5, null)).toEqual({ ...plan, total: 5 });
    expect(planFromSets(plan, null, 90)).toBeNull();
    const count = { mode: 'count' as const, total: 10 };
    expect(planFromSets(count, null, null)).toBe(count);
    expect(planFromSets(count, 3, 60)).toEqual({ mode: 'sets', total: 3, rest_seconds: 60 });
  });
});

describe('descanso entre exercícios', () => {
  it('usa o "depois" do plano', () =>
    expect(
      restBetweenExercises(
        { mode: 'sets', total: 3, rest_seconds: 60, rest_after_seconds: 120 },
        true,
      ),
    ).toBe(120));
  it('sem o "depois", o das séries (o painel só grava esse)', () =>
    expect(restBetweenExercises({ mode: 'sets', total: 3, rest_seconds: 90 }, true)).toBe(90));
  it('sem descanso nenhum, nada', () =>
    expect(restBetweenExercises({ mode: 'sets', total: 3 }, true)).toBeNull());
  it('item sem plano não descansa', () =>
    expect(restBetweenExercises({ mode: 'count', total: 1 }, false)).toBeNull());
  it('contador não usa o descanso das séries', () =>
    expect(restBetweenExercises({ mode: 'count', total: 5, rest_seconds: 30 }, true)).toBeNull());
});

describe('séries avançadas', () => {
  // O treino do dono em 19/10: 1 de 14, 2 de 10, 1 de 8
  const meta = {
    sets: 4,
    reps: 14,
    weight: '40kg',
    groups: [
      { sets: 1, reps: 14 },
      { sets: 2, reps: 10, weight: '45kg' },
      { sets: 1, reps: 8 },
    ],
  };
  it('grupos mal formados saem', () =>
    expect(
      setGroups({
        groups: [
          { sets: 0, reps: 3 },
          { sets: 2, reps: -1, weight: ' ' },
        ] as never,
      }),
    ).toEqual([{ sets: 2 }]));
  it('sem grupos, lista vazia', () => expect(setGroups({ sets: 3, reps: 10 })).toEqual([]));
  it('cada série pega o seu grupo', () =>
    expect([0, 1, 2, 3].map((n) => setPrescription(meta, n))).toEqual([
      { reps: 14, weight: '40kg', group: 0 },
      { reps: 10, weight: '45kg', group: 1 },
      { reps: 10, weight: '45kg', group: 1 },
      { reps: 8, weight: '40kg', group: 2 },
    ]));
  it('série a mais repete o último grupo', () =>
    expect(setPrescription(meta, 4)).toEqual({ reps: 8, weight: '40kg', group: 2 }));
  it('sem grupos, o do item', () =>
    expect(setPrescription({ reps: 12, weight: '20kg' }, 2)).toEqual({
      reps: 12,
      weight: '20kg',
      group: -1,
    }));
  it('carga ± muda só o grupo da série', () => {
    const next = adjustSetWeight(meta, 3, 2.5);
    expect(next.groups?.map((g) => g.weight)).toEqual([undefined, '45kg', '42,5kg']);
    expect(next.weight).toBe('40kg');
  });
  it('carga ± no primeiro grupo acompanha a do item', () =>
    expect(adjustSetWeight(meta, 0, -5).weight).toBe('35kg'));
  it('sem grupos, a carga do item', () =>
    expect(adjustSetWeight({ weight: '20kg' }, 0, 2.5)).toEqual({ weight: '22,5kg' }));
  it('rótulo com a carga só onde muda', () =>
    expect(
      groupsLabel([
        { sets: 1, reps: 14, weight: '40kg' },
        { sets: 2, reps: 10, weight: '40kg' },
        { sets: 1, reps: 8, weight: '45kg' },
        { sets: 1 },
      ]),
    ).toBe('1x14 40kg · 2x10 · 1x8 45kg · 1x?'));
});
