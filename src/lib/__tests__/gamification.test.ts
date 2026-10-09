import { describe, expect, test } from '@jest/globals';

import { levelFromXp, rewardMessage, xpToNext } from '../gamification';
import { gamificationConfig } from '../gamification.config';

declare const require: (id: string) => unknown;

describe('curva de nível (mesmos casos do pgTAP fase3_gamificacao)', () => {
  test.each([
    [1, 100],
    [2, 264],
    [10, 2512],
  ])('nível %i → próximo: %i XP', (level, xp) => expect(xpToNext(level)).toBe(xp));

  test.each([
    [0, 1, 0],
    [99, 1, 99],
    [100, 2, 0],
    [363, 2, 263],
    [364, 3, 0],
  ])('%i XP = nível %i, %i dentro do nível', (xp, level, intoLevel) => {
    expect(levelFromXp(xp)).toMatchObject({ level, intoLevel });
  });

  test('XP negativo conta como 0', () => {
    expect(levelFromXp(-5)).toEqual({ level: 1, intoLevel: 0, forNext: 100 });
  });
});

describe('gamification.config.ts', () => {
  test('é igual ao public.xp_rules() da migração (quem concede o XP é o banco)', () => {
    // Sem @types/node no projeto: o Jest roda no Node, então o require existe
    const { readFileSync } = require('fs') as { readFileSync: (p: string, e: string) => string };
    const sql = readFileSync('supabase/migrations/20261011000000_fase3_gamificacao.sql', 'utf8');
    const json = /\$json\$([\s\S]*?)\$json\$/.exec(sql)?.[1];
    expect(json).toBeDefined();
    expect(JSON.parse(json ?? '{}')).toEqual(gamificationConfig);
  });
});

describe('rewardMessage', () => {
  const base = { xp: 0, level: 1, level_up: false, boss_defeated: false, achievements: [] };
  test('nada ganho: sem mensagem', () => expect(rewardMessage(base)).toBeNull());
  test('junta XP, nível, boss e conquistas', () => {
    expect(
      rewardMessage({
        xp: 10,
        level: 3,
        level_up: true,
        boss_defeated: true,
        achievements: [{ name: 'Primeiro passo', icon: '🌱' }],
      }),
    ).toBe('+10 XP · 🎉 Nível 3! · ⚔️ Boss derrotado! · 🌱 Primeiro passo');
  });
});
