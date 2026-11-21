import { describe, expect, it } from '@jest/globals';

import { addSlot, bestSlots, localToInstant, parseSlotText } from '../time-poll';

describe('localToInstant', () => {
  it('hora local do fuso → instante', () => {
    expect(localToInstant('2026-11-25', '14:00', 'America/Sao_Paulo')).toBe(
      '2026-11-25T17:00:00.000Z',
    );
    expect(localToInstant('2026-11-25', '09:30', 'UTC')).toBe('2026-11-25T09:30:00.000Z');
  });
  it('com horário de verão', () => {
    // Lisboa: inverno UTC+0, verão UTC+1
    expect(localToInstant('2026-01-15', '10:00', 'Europe/Lisbon')).toBe('2026-01-15T10:00:00.000Z');
    expect(localToInstant('2026-07-15', '10:00', 'Europe/Lisbon')).toBe('2026-07-15T09:00:00.000Z');
    expect(localToInstant('2026-07-15', '10:00', 'America/New_York')).toBe(
      '2026-07-15T14:00:00.000Z',
    );
  });
});

describe('parseSlotText', () => {
  const today = '2026-11-21';
  it('os jeitos de escrever', () => {
    expect(parseSlotText('25/11 14:00', today)).toEqual({ date: '2026-11-25', time: '14:00' });
    expect(parseSlotText('25/11/2026 9h', today)).toEqual({ date: '2026-11-25', time: '09:00' });
    expect(parseSlotText('2026-11-25 14h30', today)).toEqual({ date: '2026-11-25', time: '14:30' });
    expect(parseSlotText('25/11 às 9', today)).toEqual({ date: '2026-11-25', time: '09:00' });
    expect(parseSlotText('3/1 10:00', today)).toEqual({ date: '2027-01-03', time: '10:00' });
  });
  it('recusa o que não é horário', () => {
    expect(parseSlotText('amanhã', today)).toBeNull();
    expect(parseSlotText('25/11', today)).toBeNull();
    expect(parseSlotText('31/02 10:00', today)).toBeNull();
    expect(parseSlotText('25/11 25:00', today)).toBeNull();
  });
});

describe('votos e proposta', () => {
  it('bestSlots: os com mais gente, empate inclui todos', () => {
    const slots = [
      { id: 'a', starts_at: '', names: ['Bia', 'Caio'] },
      { id: 'b', starts_at: '', names: ['Bia'] },
      { id: 'c', starts_at: '', names: ['Caio', 'Dani'] },
    ];
    expect(bestSlots(slots)).toEqual(['a', 'c']);
    expect(bestSlots([{ id: 'a', starts_at: '', names: [] }])).toEqual([]);
  });
  it('addSlot: sem repetir, em ordem, até 5', () => {
    const a = '2026-11-25T17:00:00.000Z';
    const b = '2026-11-24T12:00:00.000Z';
    expect(addSlot([a], b)).toEqual([b, a]);
    expect(addSlot([a], '2026-11-25T17:00:00Z')).toEqual([a]);
    const five = [1, 2, 3, 4, 5].map((d) => `2026-12-0${d}T10:00:00.000Z`);
    expect(addSlot(five, '2026-12-09T10:00:00.000Z')).toHaveLength(5);
  });
});
