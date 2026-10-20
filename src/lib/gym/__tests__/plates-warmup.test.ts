import { describe, expect, it } from '@jest/globals';

import { DEFAULT_PLATES, parsePlates, plateLabel, platesPerSide } from '../plates';
import { suggestWarmup } from '../warmup';

describe('anilhas por lado', () => {
  it('fecha exato com as anilhas padrão', () => {
    expect(platesPerSide(100, 20, DEFAULT_PLATES.kg)).toEqual({
      perSide: [25, 15],
      total: 100,
      missing: 0,
      belowBar: false,
    });
    expect(platesPerSide(62.5, 20, DEFAULT_PLATES.kg).perSide).toEqual([20, 1.25]);
  });

  it('diz quanto faltou quando não fecha', () => {
    expect(platesPerSide(61, 20, DEFAULT_PLATES.kg)).toMatchObject({
      perSide: [20],
      total: 60,
      missing: 1,
    });
  });

  it('respeita quantos pares existem', () => {
    expect(platesPerSide(140, 20, [20, 10], { 20: 2 }).perSide).toEqual([20, 20, 10, 10]);
  });

  it('abaixo da barra', () => {
    expect(platesPerSide(15, 20, DEFAULT_PLATES.kg)).toMatchObject({ belowBar: true, total: 20 });
  });

  it('rótulo agrupa iguais e lê a lista digitada', () => {
    expect(plateLabel([20, 20, 2.5], 'pt-BR')).toBe('2 × 20 + 2,5');
    expect(plateLabel([], 'pt-BR')).toBe('');
    expect(parsePlates('25, 20; 2,5 1.25 x')).toEqual([25, 20, 2.5, 1.25]);
  });
});

describe('aquecimento sugerido', () => {
  it('40/60/80% ao degrau, nunca abaixo da barra', () => {
    expect(suggestWarmup(100, 20, 2.5)).toEqual([
      { weight: 40, reps: 8, pct: 40 },
      { weight: 60, reps: 5, pct: 60 },
      { weight: 80, reps: 3, pct: 80 },
    ]);
    expect(suggestWarmup(40, 20, 2.5)).toEqual([
      { weight: 20, reps: 8, pct: 40 },
      { weight: 25, reps: 5, pct: 60 },
      { weight: 32.5, reps: 3, pct: 80 },
    ]);
  });

  it('peso do corpo ou carga leve: nada', () => {
    expect(suggestWarmup(null, 20, 2.5)).toEqual([]);
    expect(suggestWarmup(25, 20, 2.5)).toEqual([]);
  });
});
