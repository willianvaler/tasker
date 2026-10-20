import { describe, expect, it } from '@jest/globals';

import {
  averageEffort,
  convertEffort,
  effortLabel,
  effortOptions,
  isValidEffort,
  rirToRpe,
  rpeToRir,
} from '../effort';
import { formatWeight, fromKg, roundToStep, textToKg, toKg, volumeKg, weightStep } from '../units';

describe('unidades', () => {
  it('converte kg e lb', () => {
    expect(toKg(100, 'lb')).toBeCloseTo(45.359, 3);
    expect(fromKg(20, 'lb')).toBeCloseTo(44.092, 3);
    expect(toKg(40, 'kg')).toBe(40);
  });

  it('passo e arredondamento', () => {
    expect(weightStep('kg')).toBe(2.5);
    expect(weightStep('lb')).toBe(5);
    expect(roundToStep(41.3, 2.5)).toBe(42.5);
    expect(roundToStep(41.2, 2.5)).toBe(40);
    expect(roundToStep(1.234, 0)).toBe(1.23);
  });

  // Os mesmos casos do _set_weight_kg (supabase/tests/diario.test.sql)
  it('texto da carga para kg', () => {
    expect(textToKg('40kg')).toBe(40);
    expect(textToKg('20,5 kg')).toBe(20.5);
    expect(textToKg('100lb')).toBe(45.36);
    expect(textToKg('90lbs')).toBe(40.82);
    expect(textToKg('40')).toBeNull();
    expect(textToKg(null)).toBeNull();
  });

  it('formata no idioma', () => {
    expect(formatWeight(42.5, 'kg', 'pt-BR')).toBe('42,5 kg');
    expect(formatWeight(42.5, 'kg', 'en')).toBe('42.5 kg');
    expect(formatWeight(20, 'lb', 'en')).toBe('44 lb');
    expect(formatWeight(45.36, 'lb', 'en')).toBe('100 lb');
  });

  it('volume sem o aquecimento', () => {
    expect(
      volumeKg([
        { weight_kg: 20, reps: 10, warmup: true },
        { weight_kg: 40, reps: 10 },
        { weight_kg: 40, reps: 8 },
        { weight_kg: null, reps: 12 },
      ]),
    ).toBe(720);
  });
});

describe('esforço', () => {
  it('opções das escalas', () => {
    expect(effortOptions('rir')).toEqual([0, 1, 2, 3, 4, 5]);
    expect(effortOptions('rpe')).toEqual([6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]);
    expect(isValidEffort('rpe', 8.5)).toBe(true);
    expect(isValidEffort('rpe', 8.25)).toBe(false);
    expect(isValidEffort('rir', 6)).toBe(false);
  });

  it('RIR ↔ RPE dentro das faixas', () => {
    expect(rirToRpe(2)).toBe(8);
    expect(rirToRpe(5)).toBe(6);
    expect(rpeToRir(10)).toBe(0);
    expect(rpeToRir(6)).toBe(4);
    expect(convertEffort(8, 'rpe', 'rir')).toBe(2);
    expect(convertEffort(3, 'rir', 'rir')).toBe(3);
  });

  it('média na escala da tela, mesmo misturando', () => {
    expect(
      averageEffort(
        [
          { effort: 2, effort_scale: 'rir' },
          { effort: 9, effort_scale: 'rpe' },
          { effort: null, effort_scale: null },
        ],
        'rpe',
      ),
    ).toBe(8.5);
    expect(averageEffort([{ effort: null }], 'rir')).toBeNull();
  });

  it('rótulo', () => {
    expect(effortLabel(8.5, 'rpe', 'pt-BR')).toBe('RPE 8,5');
    expect(effortLabel(2, 'rir', 'en')).toBe('RIR 2');
  });
});
