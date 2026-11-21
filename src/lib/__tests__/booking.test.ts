import { describe, expect, it } from '@jest/globals';

import { bookingIcs, formatDuration, groupSlots, localParts, slugify, validSlug } from '../booking';

describe('slugify', () => {
  it.each([
    ['Conversa de 30 min!', 'conversa-de-30-min'],
    ['  Revisão  técnica ', 'revisao-tecnica'],
    ['Café ☕ com Ana', 'cafe-com-ana'],
    ['---', ''],
    ['a'.repeat(50), 'a'.repeat(40)],
  ])('%s → %s', (text, want) => expect(slugify(text)).toBe(want));
  it('o resultado é aceito pelo banco', () => {
    expect(validSlug(slugify('Mentoria 1:1'))).toBe(true);
    expect(validSlug('-x')).toBe(false);
    expect(validSlug('Com Espaço')).toBe(false);
  });
});

describe('horários no fuso de quem vê', () => {
  it('localParts converte o instante', () => {
    expect(localParts('2026-11-23T12:00:00Z', 'America/Sao_Paulo')).toEqual({
      date: '2026-11-23',
      time: '09:00',
    });
    expect(localParts('2026-11-23T12:00:00Z', 'Asia/Tokyo')).toEqual({
      date: '2026-11-23',
      time: '21:00',
    });
  });
  it('groupSlots agrupa por dia, em ordem, e vira o dia pelo fuso', () => {
    const slots = ['2026-11-24T02:30:00Z', '2026-11-23T13:00:00Z', '2026-11-23T12:00:00Z'];
    expect(groupSlots(slots, 'America/Sao_Paulo')).toEqual([
      {
        date: '2026-11-23',
        slots: [
          { iso: '2026-11-23T12:00:00Z', time: '09:00' },
          { iso: '2026-11-23T13:00:00Z', time: '10:00' },
          { iso: '2026-11-24T02:30:00Z', time: '23:30' },
        ],
      },
    ]);
    expect(groupSlots(slots, 'UTC').map((d) => d.date)).toEqual(['2026-11-23', '2026-11-24']);
  });
});

describe('formatDuration', () => {
  it.each([
    [15, '15 min'],
    [60, '1 h'],
    [90, '1 h 30'],
  ])('%i', (m, want) => expect(formatDuration(m)).toBe(want));
});

describe('bookingIcs', () => {
  it('monta o evento em UTC, com o texto escapado e CRLF', () => {
    const ics = bookingIcs({
      uid: 'abc',
      starts_at: '2026-11-23T12:00:00.000Z',
      ends_at: '2026-11-23T13:00:00Z',
      title: 'Conversa, com Ana; sobre x',
      description: 'linha 1\nlinha 2',
      url: 'https://exemplo.com/reserva/abc',
      now: '2026-11-21T10:00:00Z',
    });
    expect(ics.split('\r\n')).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Questlist//Agenda//PT',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:abc@questlist',
      'DTSTAMP:20261121T100000Z',
      'DTSTART:20261123T120000Z',
      'DTEND:20261123T130000Z',
      'SUMMARY:Conversa\\, com Ana\\; sobre x',
      'DESCRIPTION:linha 1\\nlinha 2',
      'URL:https://exemplo.com/reserva/abc',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ]);
  });
});
