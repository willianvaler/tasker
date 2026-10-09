import { describe, expect, it } from '@jest/globals';

import { formatDueDate, todayIn } from '../dates';

describe('todayIn', () => {
  it('usa o fuso: 01:00 UTC ainda é ontem em São Paulo', () => {
    const now = new Date('2026-10-09T01:00:00Z');
    expect(todayIn('America/Sao_Paulo', now)).toBe('2026-10-08');
    expect(todayIn('UTC', now)).toBe('2026-10-09');
  });
});

describe('formatDueDate', () => {
  const today = '2026-10-08';
  it.each([
    ['2026-10-08', 'Hoje'],
    ['2026-10-09', 'Amanhã'],
    ['2026-10-07', 'Ontem'],
    ['2026-10-16', 'sex, 16 out'],
    ['2027-01-05', 'ter, 5 jan 2027'],
  ])('%s', (date, label) => expect(formatDueDate(date, today)).toBe(label));
});
