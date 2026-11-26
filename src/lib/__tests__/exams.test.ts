import { describe, expect, it } from '@jest/globals';

import {
  chartRange,
  examKey,
  groupExams,
  parseExamValue,
  parseOptionalValue,
  refText,
  type ExamResult,
} from '../exams';

const r = (id: string, day: string, name: string, value: number, extra: Partial<ExamResult> = {}) =>
  ({
    id,
    day,
    name,
    value,
    unit: 'mg/dL',
    ref_low: null,
    ref_high: null,
    note: '',
    file_path: null,
    file_mime: null,
    ...extra,
  }) as ExamResult;

describe('groupExams', () => {
  it('junta grafias diferentes, ordena por data e usa o nome do mais recente', () => {
    const groups = groupExams([
      r('3', '2026-09-01', 'glicose ', 90),
      r('1', '2026-01-10', 'Glicose', 100),
      r('2', '2026-05-10', 'GLICOSE', 95),
      r('4', '2026-05-10', 'Colesterol total', 180),
    ]);
    expect(groups.map((g) => g.name)).toEqual(['Colesterol total', 'glicose']);
    expect(groups[1].results.map((x) => x.id)).toEqual(['1', '2', '3']);
    expect(groups[1].latest.value).toBe(90);
  });

  it('acento e espaço não separam o exame', () => {
    expect(examKey('  Hemoglobina   glicada ')).toBe(examKey('hemoglobina glicada'));
    expect(examKey('Ácido úrico')).toBe('acido urico');
  });
});

describe('parseExamValue', () => {
  it.each([
    ['92', 92],
    ['5,4', 5.4],
    ['0.85', 0.85],
    ['-1,5', -1.5],
    ['1.250,5', 1250.5],
    ['', null],
    ['abc', null],
    ['<5', null],
    ['1e12', null],
  ])('%s → %s', (text, value) => expect(parseExamValue(text)).toBe(value));

  it('faixa opcional: vazio é sem faixa, inválido é erro', () => {
    expect(parseOptionalValue('')).toBeNull();
    expect(parseOptionalValue('70')).toBe(70);
    expect(parseOptionalValue('x')).toBeUndefined();
  });
});

describe('refText', () => {
  it('mostra a faixa como foi digitada, sem julgar', () => {
    expect(refText(70, 99, 'mg/dL')).toBe('70–99 mg/dL');
    expect(refText(70, null, 'mg/dL')).toBe('≥ 70 mg/dL');
    expect(refText(null, 5.5, '%')).toBe('≤ 5,5 %');
    expect(refText(null, null, 'mg/dL')).toBeNull();
  });
});

describe('chartRange', () => {
  it('inclui a faixa e dá folga; um valor só não fica com eixo zerado', () => {
    const [g] = groupExams([r('1', '2026-01-01', 'G', 90, { ref_low: 70, ref_high: 110 })]);
    expect(chartRange(g)).toEqual({ min: 66, max: 114 });
    const [h] = groupExams([r('1', '2026-01-01', 'G', 5)]);
    expect(chartRange(h)).toEqual({ min: 4, max: 6 });
  });
});
