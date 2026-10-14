import { describe, expect, test } from '@jest/globals';

import {
  applyMention,
  mentionQuery,
  mentionToken,
  resolveMention,
  suggestMembers,
} from '../members';

const ana = { userId: 'a', displayName: 'Ana Lima', aliases: [] };
const anaPaula = { userId: 'b', displayName: 'Ana Paula', aliases: [] };
const greg = { userId: 'g', displayName: 'Grégory Souza', aliases: ['greg'] };
const members = [ana, anaPaula, greg];

describe('autocomplete do @nome', () => {
  test('acha o @ em digitação antes do cursor', () => {
    expect(mentionQuery('Carvão @an', 10)).toEqual({ start: 7, query: 'an' });
    expect(mentionQuery('@', 1)).toEqual({ start: 0, query: '' });
    expect(mentionQuery('email@x', 7)).toBeNull();
    expect(mentionQuery('Carvão @ana sexta', 17)).toBeNull();
  });

  test('sugere por começo de nome, sobrenome ou apelido, sem acento', () => {
    expect(suggestMembers('an', members).map((m) => m.userId)).toEqual(['a', 'b']);
    expect(suggestMembers('sou', members).map((m) => m.userId)).toEqual(['g']);
    expect(suggestMembers('GRE', members).map((m) => m.userId)).toEqual(['g']);
    expect(suggestMembers('', members)).toHaveLength(3);
  });

  test('o token escolhido resolve só na pessoa', () => {
    expect(mentionToken(greg, members)).toBe('Grégory');
    expect(mentionToken(ana, members)).toBe('AnaLima');
    for (const m of members)
      expect(resolveMention(mentionToken(m, members), members)).toMatchObject({
        kind: 'member',
        userId: m.userId,
      });
  });

  test('troca o que foi digitado e põe o cursor depois', () => {
    expect(applyMention('Carvão @an sexta', 7, 10, 'AnaLima')).toEqual({
      text: 'Carvão @AnaLima sexta',
      caret: 16,
    });
    expect(applyMention('@', 0, 1, 'Grégory')).toEqual({ text: '@Grégory ', caret: 9 });
  });
});
