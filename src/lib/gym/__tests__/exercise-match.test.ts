import { describe, expect, test } from '@jest/globals';

import { filterExercises } from '../exercise-filter';
import { matchScore, nameTokens, normalizeName, suggestExercises } from '../exercise-match';

const ex = (id: string, name_en: string, name_pt: string, extra = {}) => ({
  id,
  name_en,
  name_pt,
  equipment: 'barbell',
  body_part: 'chest',
  target: 'chest',
  secondary: ['triceps'],
  ...extra,
});
const LIST = [
  ex('1', 'Barbell bench press', 'Supino reto com barra'),
  ex('2', 'Dumbbell incline bench press', 'Supino inclinado com halteres', {
    equipment: 'dumbbell',
  }),
  ex('3', 'Barbell full squat', 'Agachamento livre com barra', {
    body_part: 'legs',
    target: 'quads',
    secondary: ['glutes'],
  }),
  ex('4', 'Cable lateral raise', 'Elevação lateral na polia', {
    equipment: 'cable',
    body_part: 'shoulders',
    target: 'shoulders',
    secondary: [],
  }),
];

describe('normalizeName', () => {
  test('tira acento, séries, carga e pontuação', () => {
    expect(normalizeName('Supino Reto 4x10 40kg!')).toBe('supino reto');
    expect(normalizeName('Elevação lateral 3 x 12')).toBe('elevacao lateral');
  });
});

describe('nameTokens', () => {
  test('sinônimos de academia somam a palavra do catálogo', () => {
    expect([...nameTokens('supino')]).toEqual(expect.arrayContaining(['supino', 'bench', 'press']));
  });
});

describe('suggestExercises', () => {
  test('português de academia acha o certo', () => {
    expect(suggestExercises('Supino reto 4x10 40kg', LIST)[0].exercise.id).toBe('1');
    expect(suggestExercises('agachamento', LIST)[0].exercise.id).toBe('3');
    expect(suggestExercises('elevação lateral', LIST)[0].exercise.id).toBe('4');
  });
  test('inglês também', () => {
    expect(suggestExercises('bench press', LIST)[0].exercise.id).toBe('1');
  });
  test('supino acha bench press antes de "bench dips" (press não perde o s)', () => {
    const list = [...LIST, ex('9', 'Bench dips', '')];
    expect(suggestExercises('supino', list)[0].exercise.id).toBe('1');
  });
  test('nada parecido: nada', () => {
    expect(suggestExercises('comprar pão', LIST)).toEqual([]);
  });
  test('nome exato vale 1', () => {
    expect(matchScore('Supino reto com barra', LIST[0])).toBe(1);
  });
});

describe('filterExercises', () => {
  const name = (e: (typeof LIST)[number]) => e.name_pt;
  test('equipamento que a pessoa tem', () => {
    expect(filterExercises(LIST, { equipment: ['dumbbell'] }, name).map((e) => e.id)).toEqual([
      '2',
    ]);
  });
  test('músculo conta o sinergista', () => {
    expect(filterExercises(LIST, { muscle: 'glutes' }, name).map((e) => e.id)).toEqual(['3']);
  });
  test('parte do corpo e texto juntos', () => {
    expect(
      filterExercises(LIST, { bodyPart: 'chest', query: 'supino' }, name).map((e) => e.id),
    ).toEqual(['1', '2']);
  });
  test('sem filtro, por nome', () => {
    expect(filterExercises(LIST, {}, name).map((e) => e.id)).toEqual(['3', '4', '2', '1']);
  });
});
