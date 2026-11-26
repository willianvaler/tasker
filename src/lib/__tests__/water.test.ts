import { describe, expect, it } from '@jest/globals';

import {
  dayTotal,
  formatWater,
  goalProgress,
  parseWaterAmount,
  waterWeek,
  weekAverage,
  type WaterLog,
} from '../water';

const log = (day: string, ml: number, id = `${day}-${ml}`): WaterLog => ({
  id,
  day,
  ml,
  logged_at: `${day}T12:00:00Z`,
});

describe('água (SA2)', () => {
  const logs = [log('2026-11-26', 250), log('2026-11-26', 500), log('2026-11-24', 1000)];

  it('soma o dia', () => {
    expect(dayTotal(logs, '2026-11-26')).toBe(750);
    expect(dayTotal(logs, '2026-11-25')).toBe(0);
  });

  it('a semana termina hoje, e a média ignora os dias sem registro', () => {
    const week = waterWeek(logs, '2026-11-26');
    expect(week).toHaveLength(7);
    expect(week[0].day).toBe('2026-11-20');
    expect(week[6]).toEqual({ day: '2026-11-26', ml: 750 });
    expect(week[4]).toEqual({ day: '2026-11-24', ml: 1000 });
    expect(weekAverage(week)).toBe(875);
    expect(weekAverage(waterWeek([], '2026-11-26'))).toBe(0);
  });

  it('progresso da meta', () => {
    expect(goalProgress(1000, 2000)).toBe(0.5);
    expect(goalProgress(2500, 2000)).toBe(1.25);
    expect(goalProgress(100, 0)).toBe(0);
  });

  it('lê mL e litros, com vírgula ou ponto, dentro dos limites', () => {
    expect(parseWaterAmount('300')).toBe(300);
    expect(parseWaterAmount('300 ml')).toBe(300);
    expect(parseWaterAmount('0,5 l')).toBe(500);
    expect(parseWaterAmount('1.5L')).toBe(1500);
    expect(parseWaterAmount('0')).toBeNull();
    expect(parseWaterAmount('6 l')).toBeNull();
    expect(parseWaterAmount('um copo')).toBeNull();
  });

  it('mostra mL abaixo de 1 L e litros acima', () => {
    expect(formatWater(250, 'pt-BR')).toBe('250 mL');
    expect(formatWater(1500, 'pt-BR')).toBe('1,5 L');
    expect(formatWater(2000, 'en')).toBe('2 L');
  });
});
