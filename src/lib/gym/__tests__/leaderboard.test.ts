import { describe, expect, it } from '@jest/globals';

import { challengeProgress, leaderboard, podium, type ActivityDay } from '../leaderboard';

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
