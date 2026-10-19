import { describe, expect, test } from '@jest/globals';

import {
  favoriteFood,
  manaSkillBlock,
  manaSkillsFor,
  mountProgress,
  parseCompanion,
  portraitKey,
  strikeDamage,
} from '../game-mode';

// Os mesmos números do modo_jogo.test.sql e do cast_mana_skill
describe('modo jogo (ESCOPO_V8)', () => {
  test('4 habilidades por classe, liberadas por nível', () => {
    for (const cls of ['lutador', 'mago', 'arqueiro', 'paladino', 'ladino']) {
      const skills = manaSkillsFor(cls);
      expect(skills).toHaveLength(4);
      expect(skills.map((s) => s.level)).toEqual([3, 5, 8, 11]);
    }
    expect(manaSkillsFor(null)).toEqual([]);
  });

  test('golpe: poder + Força', () => {
    const [golpe, pele] = manaSkillsFor('lutador');
    expect(strikeDamage(golpe, 5)).toBe(13);
    expect(strikeDamage(pele, 5)).toBe(0);
  });

  test('o que impede de usar', () => {
    const [golpe] = manaSkillsFor('lutador');
    expect(manaSkillBlock(golpe, { level: 2, mp: 50, dead: false })).toBe('level');
    expect(manaSkillBlock(golpe, { level: 3, mp: 9, dead: false })).toBe('mana');
    expect(manaSkillBlock(golpe, { level: 3, mp: 10, dead: true })).toBe('dead');
    expect(manaSkillBlock(golpe, { level: 3, mp: 10, dead: false })).toBeNull();
  });

  test('retrato, companheiro, comida favorita e montaria', () => {
    expect(portraitKey('mago', 'm-escura')).toBe('mago-m-escura');
    expect(portraitKey('mago', undefined)).toBe('mago-f-clara');
    expect(portraitKey('mago', 'inventado')).toBe('mago-f-clara');
    expect(portraitKey(null, 'f-clara')).toBeNull();
    expect(parseCompanion('lobo:gelo')).toEqual({ species: 'lobo', potion: 'gelo' });
    expect(parseCompanion(null)).toBeNull();
    expect(favoriteFood('gelo')).toBe('peixe');
    expect(mountProgress(25)).toBe(0.5);
    expect(mountProgress(80)).toBe(1);
  });
});
