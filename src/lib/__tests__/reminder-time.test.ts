import { describe, expect, test } from '@jest/globals';

import { reminderAt, zonedEpoch } from '../reminder-time';

describe('horário do lembrete (D206)', () => {
  test('São Paulo (UTC−3)', () => {
    expect(new Date(zonedEpoch('2026-10-20', '15:00', 'America/Sao_Paulo')).toISOString()).toBe(
      '2026-10-20T18:00:00.000Z',
    );
  });
  test('Lisboa no horário de verão e no de inverno', () => {
    expect(new Date(zonedEpoch('2026-07-01', '09:30:00', 'Europe/Lisbon')).toISOString()).toBe(
      '2026-07-01T08:30:00.000Z',
    );
    expect(new Date(zonedEpoch('2026-12-01', '09:30', 'Europe/Lisbon')).toISOString()).toBe(
      '2026-12-01T09:30:00.000Z',
    );
  });
  test('antecedência e falta de dados', () => {
    const at = reminderAt(
      { due_date: '2026-10-20', due_time: '15:00:00', remind_before: 30 },
      'America/Sao_Paulo',
    );
    expect(new Date(at ?? 0).toISOString()).toBe('2026-10-20T17:30:00.000Z');
    expect(reminderAt({ due_date: '2026-10-20', due_time: null, remind_before: 0 }, 'UTC')).toBeNull();
    expect(reminderAt({ due_date: '2026-10-20', due_time: '10:00', remind_before: null }, 'UTC')).toBeNull();
  });
});
