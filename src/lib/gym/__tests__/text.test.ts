import { describe, expect, it } from '@jest/globals';

import { normalize, tokens } from '../text';

describe('normalize', () => {
  it('tira acento, pontuação e caixa', () => {
    expect(normalize('Supino Reto (Barra)!')).toBe('supino reto barra');
    expect(normalize('  Elevação   lateral ')).toBe('elevacao lateral');
    expect(normalize('3/4 Sit-up')).toBe('3 4 sit up');
  });
});

describe('tokens', () => {
  it('sem palavras vazias em pt, en e es', () => {
    expect(tokens('Rosca direta com barra')).toEqual(['rosca', 'direta', 'barra']);
    expect(tokens('Press with the bar')).toEqual(['press', 'bar']);
    expect(tokens('Curl con barra en banco')).toEqual(['curl', 'barra', 'banco']);
  });
});
