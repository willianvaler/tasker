import { describe, expect, it } from '@jest/globals';

import {
  DEFAULT_POMODORO,
  estimatedPomodoros,
  nextPhase,
  phaseSeconds,
  pickIdea,
} from '../pomodoro';

describe('fases', () => {
  it('foco → pausa curta', () =>
    expect(nextPhase({ phase: 'focus', cycle: 1 }, 4)).toEqual({ phase: 'short', cycle: 1 }));
  it('pausa curta → próximo foco', () =>
    expect(nextPhase({ phase: 'short', cycle: 1 }, 4)).toEqual({ phase: 'focus', cycle: 2 }));
  it('último foco → pausa longa', () =>
    expect(nextPhase({ phase: 'focus', cycle: 4 }, 4)).toEqual({ phase: 'long', cycle: 4 }));
  it('pausa longa recomeça o ciclo', () =>
    expect(nextPhase({ phase: 'long', cycle: 4 }, 4)).toEqual({ phase: 'focus', cycle: 1 }));
  it('duração de cada fase', () => {
    expect(phaseSeconds(DEFAULT_POMODORO, 'focus')).toBe(1500);
    expect(phaseSeconds(DEFAULT_POMODORO, 'short')).toBe(300);
    expect(phaseSeconds(DEFAULT_POMODORO, 'long')).toBe(900);
  });
});

describe('sugestões', () => {
  const ideas = ['café', 'ar', 'água'];
  it('em ordem, dá a volta', () => {
    expect(pickIdea(ideas, 'sequence', 0)).toBe('café');
    expect(pickIdea(ideas, 'sequence', 4)).toBe('ar');
  });
  it('sorteada', () => expect(pickIdea(ideas, 'random', 0, () => 0.99)).toBe('água'));
  it('lista vazia: nada', () => expect(pickIdea([], 'random', 0)).toBeUndefined());
});

it('estimados: estimativa ÷ foco, para cima', () => {
  expect(estimatedPomodoros(60, 25)).toBe(3);
  expect(estimatedPomodoros(null, 25)).toBeNull();
});
