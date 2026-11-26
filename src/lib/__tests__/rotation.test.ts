import { describe, expect, it } from '@jest/globals';

import { moveInOrder, readRotation, rotationCounts, rotationQueue } from '../rotation';

describe('rodízio (CS2)', () => {
  it('lê o estado da RPC e recusa o que não é rodízio', () => {
    expect(readRotation(null)).toBeNull();
    expect(readRotation({ members: ['a'], mode: 'x', current_index: 0, counts: [] })).toBeNull();
    expect(
      readRotation({ members: ['a', 'b'], mode: 'week', current_index: 1, counts: [] })?.mode,
    ).toBe('week');
  });

  it('a fila começa em quem está na vez', () => {
    expect(rotationQueue(['a', 'b', 'c'], 0)).toEqual(['a', 'b', 'c']);
    expect(rotationQueue(['a', 'b', 'c'], 2)).toEqual(['c', 'a', 'b']);
    expect(rotationQueue(['a', 'b', 'c'], 4)).toEqual(['b', 'c', 'a']);
    expect(rotationQueue([], 3)).toEqual([]);
  });

  it('sobe e desce na ordem sem sair dos limites', () => {
    expect(moveInOrder(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveInOrder(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(moveInOrder(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveInOrder(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });

  it('quem nunca fez conta zero', () => {
    const state = readRotation({
      members: ['a', 'b'],
      mode: 'turn',
      current_index: 0,
      counts: [{ user_id: 'b', total: 3, week: 1 }],
    })!;
    expect(rotationCounts(state)).toEqual([
      { userId: 'a', total: 0, week: 0 },
      { userId: 'b', total: 3, week: 1 },
    ]);
  });
});
