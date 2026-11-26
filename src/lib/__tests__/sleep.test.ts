import { describe, expect, it } from '@jest/globals';

import {
  clockText,
  formatDuration,
  parseClock,
  sleepAverage,
  sleepMinutes,
  sleepWeek,
  type SleepLog,
} from '../sleep';

const log = (day: string, bed: string, wake: string): SleepLog => ({
  id: `${day}-${bed}`,
  day,
  bed_time: bed,
  wake_time: wake,
});

describe('sono (SA1)', () => {
  it('lê a hora de vários jeitos', () => {
    expect(parseClock('23:30')).toBe(1410);
    expect(parseClock('7:05')).toBe(425);
    expect(parseClock('7h')).toBe(420);
    expect(parseClock('07h30')).toBe(450);
    expect(parseClock('22')).toBe(1320);
    expect(parseClock('24:00')).toBeNull();
    expect(parseClock('7:60')).toBeNull();
    expect(parseClock('cedo')).toBeNull();
    expect(clockText(425)).toBe('07:05');
  });

  it('a duração passa da meia-noite quando precisa', () => {
    expect(sleepMinutes('23:30:00', '07:00:00')).toBe(450);
    expect(sleepMinutes('01:00', '08:15')).toBe(435);
    expect(sleepMinutes('14:00', '14:40')).toBe(40);
    expect(sleepMinutes('08:00', '07:59')).toBe(1439);
  });

  it('formata a duração', () => {
    expect(formatDuration(450)).toBe('7 h 30 min');
    expect(formatDuration(480)).toBe('8 h');
    expect(formatDuration(45)).toBe('45 min');
  });

  it('a semana soma cochilos do dia e a média ignora os dias sem registro', () => {
    const logs = [
      log('2026-11-26', '23:00', '07:00'),
      log('2026-11-26', '14:00', '14:30'),
      log('2026-11-24', '00:00', '06:00'),
    ];
    const week = sleepWeek(logs, '2026-11-26');
    expect(week[6]).toEqual({ day: '2026-11-26', minutes: 510 });
    expect(week[4]).toEqual({ day: '2026-11-24', minutes: 360 });
    expect(sleepAverage(week)).toBe(435);
    expect(sleepAverage(sleepWeek([], '2026-11-26'))).toBe(0);
  });
});
