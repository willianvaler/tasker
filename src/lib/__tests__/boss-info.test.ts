import { describe, expect, it } from '@jest/globals';

import { bossHoursLeft, bossReward } from '@/lib/boss-info';

describe('bossReward (espelho do _sync_boss_rewards)', () => {
  it('semanal: 50 XP, ouro do nível e item certo', () => {
    expect(bossReward({ scope: 'user', level: 3, ends_at: '' })).toEqual({
      xp: 50,
      gold: 40,
      dropChance: 1,
      nextHp: 518,
    });
  });

  it('do dia: 15 XP, ouro menor e só chance de item', () => {
    expect(bossReward({ scope: 'daily', level: 1, ends_at: '' })).toMatchObject({
      xp: 15,
      gold: 5,
      dropChance: 0.15,
    });
  });

  it('clã e projeto ficam sem', () => {
    expect(bossReward({ scope: 'clan', level: 1, ends_at: '' })).toBeNull();
    expect(bossReward({ scope: 'folder', ends_at: '' })).toBeNull();
  });
});

describe('bossHoursLeft', () => {
  const end = '2026-10-25T03:00:00.000Z';
  it('horas inteiras até fugir, nunca negativo', () => {
    expect(bossHoursLeft(end, Date.parse('2026-10-24T21:30:00.000Z'))).toBe(5);
    expect(bossHoursLeft(end, Date.parse('2026-10-25T04:00:00.000Z'))).toBe(0);
  });
});
