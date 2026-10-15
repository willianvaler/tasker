import { describe, expect, test } from '@jest/globals';

import {
  bossHpForLevel,
  dailyBossHp,
  critChance,
  goldFor,
  healAmount,
  hitDamage,
  totalAttributes,
  weightFactor,
} from '../character';
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
  test('é igual ao public.xp_rules() da migração mais nova (quem concede o XP é o banco)', () => {
    // Sem @types/node no projeto: o Jest roda no Node, então o require existe
    const fs = require('fs') as {
      readFileSync: (p: string, e: string) => string;
      readdirSync: (p: string) => string[];
    };
    const dir = 'supabase/migrations';
    const latest = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => fs.readFileSync(`${dir}/${f}`, 'utf8'))
      .filter((sql) => sql.includes('function public.xp_rules()'))
      .pop();
    const json = /\$json\$([\s\S]*?)\$json\$/.exec(latest ?? '')?.[1];
    expect(json).toBeDefined();
    expect(JSON.parse(json ?? '{}')).toEqual(gamificationConfig);
  });
});

describe('personagem (mesmos casos do pgTAP fase7_rpg)', () => {
  const none = { str: 0, agi: 0, int: 0, con: 0 };

  test.each([
    [1, 300],
    [2, 360],
    [5, 622],
  ])('boss nível %i: %i HP', (level, hp) => expect(bossHpForLevel(level)).toBe(hp));

  // Os mesmos casos do pgTAP boss_diario
  test.each([
    [1, 60],
    [2, 63],
    [100, 180],
  ])('boss diário nível %i: %i HP', (level, hp) => expect(dailyBossHp(level)).toBe(hp));

  test('sem classe, todos os atributos em 1; lutador ganha Força e Constituição', () => {
    expect(totalAttributes(null, none)).toEqual({ str: 1, agi: 1, int: 1, con: 1 });
    expect(totalAttributes('lutador', none)).toEqual({ str: 4, agi: 1, int: 1, con: 2 });
    expect(totalAttributes('mago', { ...none, int: 2 })).toEqual({
      str: 1,
      agi: 2,
      int: 6,
      con: 1,
    });
  });

  test('tarefa do lutador no primeiro golpe: 4 × 1,2 × 2 = 9,6 → 10 (crítico 19)', () => {
    const attrs = totalAttributes('lutador', none);
    expect(hitDamage(4, 'task', 'lutador', attrs, { firstStrike: true })).toEqual({
      normal: 10,
      crit: 19,
    });
    expect(hitDamage(4, 'task', 'lutador', attrs).normal).toBe(5);
  });

  test('sem classe: tarefa 4 × 1,05 → 4; hábito 3 × 1,05 → 3', () => {
    const attrs = totalAttributes(null, none);
    expect(hitDamage(4, 'task', null, attrs).normal).toBe(4);
    expect(hitDamage(3, 'routine', null, attrs).normal).toBe(3);
  });

  test('mago: sequência e Tempestade somam no multiplicador', () => {
    const attrs = totalAttributes('mago', none);
    // 3 × (1 + 0,2 + 0,2 + 0,5) = 5,7 → 6
    expect(hitDamage(3, 'routine', 'mago', attrs, { streak: 10, skillActive: true }).normal).toBe(
      6,
    );
  });

  test('crítico: 2% por Agilidade, arqueiro com Mira certeira', () => {
    expect(critChance(null, totalAttributes(null, none))).toBeCloseTo(0.02);
    expect(critChance('arqueiro', totalAttributes('arqueiro', none), true)).toBeCloseTo(0.33);
  });

  test('cura do hábito ruim: 8 × (1 − 0,08 × CON); paladino cura metade', () => {
    // lutador CON 2: 8 × 0,84 = 6,72 → 7; paladino CON 4: 8 × 0,68 × 0,5 = 2,72 → 3
    expect(healAmount('lutador', totalAttributes('lutador', none))).toBe(7);
    expect(healAmount('paladino', totalAttributes('paladino', none))).toBe(3);
  });

  test('ouro: 2 × (1 + 0,03 × CON); ladino +50%', () => {
    expect(goldFor(2, 'lutador', totalAttributes('lutador', none))).toBe(2);
    expect(goldFor(2, 'ladino', totalAttributes('ladino', none))).toBe(3);
  });
});

describe('rewardMessage', () => {
  const base = { xp: 0, level: 1, level_up: false, boss_defeated: false, achievements: [] };
  test('nada ganho: sem mensagem', () => expect(rewardMessage(base)).toBeNull());
  test('junta XP, dano, ouro, nível, boss, item e conquistas', () => {
    expect(
      rewardMessage({
        xp: 10,
        level: 3,
        level_up: true,
        boss_defeated: true,
        damage: 9,
        crit: true,
        gold: 2,
        drops: [{ name: 'Coroa', icon: '👑' }],
        achievements: [{ name: 'Primeiro passo', icon: '🌱' }],
      }),
    ).toBe(
      '+10 XP · 💥 9 de dano (crítico!) · 🪙 +2 · 🎉 Nível 3! · 🏆 Boss derrotado! · 🎁 👑 Coroa · 🌱 Primeiro passo',
    );
  });
  test('relâmpago: sem XP, mas o golpe aparece', () => {
    expect(rewardMessage({ ...base, damage: 4 })).toBe('⚔️ 4 de dano');
  });
  test('O3: barras do dia e da semana, quem caiu e o limite do dia', () => {
    const boss = (hp: number, max: number, status = 'active') => ({ hp, max_hp: max, status });
    expect(
      rewardMessage({
        ...base,
        xp: 10,
        damage: 11,
        bosses: { daily: boss(49, 60), weekly: boss(289, 300) },
      }),
    ).toBe('+10 XP · ⚔️ 11 de dano · dia 49/60 · semana 289/300');
    expect(
      rewardMessage({
        ...base,
        damage: 11,
        boss_defeated: true,
        bosses: { daily: boss(0, 60, 'defeated'), weekly: boss(278, 300) },
        defeated_now: ['daily'],
      }),
    ).toBe('⚔️ 11 de dano · semana 278/300 · 🏆 Boss do dia derrotado!');
    expect(rewardMessage({ ...base, limit: 'habit' })).toBe(
      'limite diário deste hábito atingido (10 "+")',
    );
    expect(rewardMessage({ ...base, xp: 3, limit: 'quick' })).toBe(
      '+3 XP · limite diário das tarefas rápidas atingido',
    );
  });
});

describe('peso da tarefa (mesmos casos do pgTAP peso)', () => {
  test('sem peso 1×, peso 5 2×', () => {
    expect(weightFactor(null)).toBe(1);
    expect(weightFactor(5)).toBe(2);
  });
});
