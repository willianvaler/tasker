import { describe, expect, it } from '@jest/globals';

import {
  activityPoints,
  boardActivity,
  challengeProgress,
  leaderboard,
  podium,
  type ActivityDay,
} from '../leaderboard';

const range = { start: '2026-10-01', end: '2026-10-10', today: '2026-10-05' };
const day = (userId: string, d: number, points?: number): ActivityDay => ({
  userId,
  day: `2026-10-${String(d).padStart(2, '0')}`,
  points,
});

describe('leaderboard', () => {
  it('dias distintos: dois treinos no mesmo dia contam um', () => {
    const board = leaderboard([day('ana', 1), day('ana', 1), day('ana', 2)], ['ana'], range);
    expect(board[0]).toMatchObject({ userId: 'ana', days: 2 });
  });
  it('quem não treinou aparece com zero, no fim', () => {
    const board = leaderboard([day('ana', 1)], ['bia', 'ana'], range);
    expect(board.map((e) => [e.userId, e.days, e.rank])).toEqual([
      ['ana', 1, 1],
      ['bia', 0, 2],
    ]);
  });
  it('fora do desafio não conta', () => {
    const board = leaderboard(
      [
        { userId: 'ana', day: '2026-09-30' },
        { userId: 'ana', day: '2026-10-11' },
      ],
      ['ana'],
      range,
    );
    expect(board[0].days).toBe(0);
  });
  it('empate divide a posição (1, 1, 3) e desempata a ordem pela maior sequência', () => {
    const board = leaderboard(
      [day('ana', 1), day('ana', 3), day('bia', 1), day('bia', 2), day('caio', 4)],
      ['ana', 'bia', 'caio'],
      range,
    );
    expect(board.map((e) => [e.userId, e.rank])).toEqual([
      ['bia', 1],
      ['ana', 1],
      ['caio', 3],
    ]);
  });
  it('sequência atual: hoje sem treino ainda conta a partir de ontem', () => {
    const board = leaderboard([day('ana', 3), day('ana', 4)], ['ana'], range);
    expect(board[0]).toMatchObject({ streak: 2, best: 2 });
  });
  it('sequência atual quebra com um dia sem treino antes de ontem', () => {
    const board = leaderboard([day('ana', 1), day('ana', 2), day('ana', 3)], ['ana'], range);
    expect(board[0]).toMatchObject({ streak: 0, best: 3 });
  });
  it('sequência com hoje incluso', () => {
    const board = leaderboard([day('ana', 4), day('ana', 5)], ['ana'], range);
    expect(board[0].streak).toBe(2);
  });
  it('por pontos', () => {
    const board = leaderboard(
      [day('ana', 1, 10), day('ana', 2, 10), day('bia', 1, 30)],
      ['ana', 'bia'],
      range,
      'points',
    );
    expect(board.map((e) => [e.userId, e.points, e.rank])).toEqual([
      ['bia', 30, 1],
      ['ana', 20, 2],
    ]);
  });
  it('participante repetido aparece uma vez', () =>
    expect(leaderboard([], ['ana', 'ana'], range)).toHaveLength(1));
  it('por atividades: dois treinos no mesmo dia contam dois', () => {
    const board = leaderboard(
      [day('ana', 1), day('ana', 1), day('bia', 1), day('bia', 2), day('bia', 3)],
      ['ana', 'bia'],
      { ...range, today: '2026-10-01' },
      'activities',
    );
    expect(board.map((e) => [e.userId, e.score, e.rank])).toEqual([
      ['bia', 3, 1],
      ['ana', 2, 2],
    ]);
  });
  it('por minutos, e o dia sem atividade não conta nas atividades', () => {
    const board = leaderboard(
      [
        { userId: 'ana', day: '2026-10-01', minutes: 50 },
        { userId: 'bia', day: '2026-10-01', minutes: 30 },
        { userId: 'bia', day: '2026-10-02', minutes: 30 },
        { userId: 'bia', day: '2026-10-03', activity: false },
      ],
      ['ana', 'bia'],
      range,
      'minutes',
    );
    expect(board.map((e) => [e.userId, e.score, e.activities, e.days])).toEqual([
      ['bia', 60, 2, 3],
      ['ana', 50, 1, 1],
    ]);
  });
  it('pontos calculados das séries e dos minutos', () => {
    const board = leaderboard(
      [{ userId: 'ana', day: '2026-10-01', minutes: 20, sets: 2 }],
      ['ana'],
      range,
      'points',
    );
    expect(board[0].score).toBe(14);
  });
});

describe('activityPoints', () => {
  it('10 pelo treino, 1 por série, 1 a cada 10 minutos (o mesmo do banco)', () => {
    expect(activityPoints(25, 12)).toBe(24);
    expect(activityPoints(0, 0)).toBe(10);
    expect(activityPoints(9, 0)).toBe(10);
  });
});

describe('boardActivity', () => {
  it('atividades e os dias de treino sem atividade', () => {
    expect(
      boardActivity([
        {
          user_id: 'ana',
          days: ['2026-10-01', '2026-10-02'],
          activities: [{ day: '2026-10-02', minutes: 30, sets: 4 }],
        },
      ]),
    ).toEqual([
      { userId: 'ana', day: '2026-10-02', minutes: 30, sets: 4 },
      { userId: 'ana', day: '2026-10-01', activity: false },
    ]);
  });
});

describe('challengeProgress', () => {
  it('no meio', () => expect(challengeProgress(range)).toEqual({ total: 10, elapsed: 5, left: 5 }));
  it('antes de começar', () =>
    expect(challengeProgress({ ...range, today: '2026-09-28' })).toEqual({
      total: 10,
      elapsed: 0,
      left: 10,
    }));
  it('depois do fim', () =>
    expect(challengeProgress({ ...range, today: '2026-10-20' })).toEqual({
      total: 10,
      elapsed: 10,
      left: 0,
    }));
});

describe('pódio (AC11, espelho de _challenge_podium)', () => {
  const range = { start: '2026-10-01', end: '2026-10-07', today: '2026-10-10' };
  const day = (userId: string, d: number) => ({ userId, day: `2026-10-0${d}` });
  it('empate no 1º divide; o seguinte é o 3º', () => {
    const entries = leaderboard(
      [day('a', 1), day('a', 2), day('a', 3), day('b', 1), day('b', 4), day('b', 5), day('c', 6)],
      ['a', 'b', 'c', 'd'],
      range,
    );
    expect([...podium(entries)].sort()).toEqual([
      ['a', 1],
      ['b', 1],
      ['c', 3],
    ]);
  });
  it('sem disputa (só uma pessoa treinou), sem pódio', () =>
    expect(podium(leaderboard([day('a', 1)], ['a', 'b'], range)).size).toBe(0));
  it('quarto lugar fica de fora', () => {
    const entries = leaderboard(
      [
        day('a', 1),
        day('a', 2),
        day('a', 3),
        day('a', 4),
        day('b', 1),
        day('b', 2),
        day('b', 3),
        day('c', 1),
        day('c', 2),
        day('d', 1),
      ],
      ['a', 'b', 'c', 'd'],
      range,
    );
    expect(podium(entries).has('d')).toBe(false);
    expect(podium(entries).get('c')).toBe(3);
  });
});
