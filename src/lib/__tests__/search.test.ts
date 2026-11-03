import { describe, expect, it } from '@jest/globals';

import {
  hasOperators,
  isEmptySearch,
  matchSearch,
  parseSearch,
  pickRandom,
  searchRank,
} from '../search';
import { isFavorite, liveFavorites, readFavorites, toggleFavorite } from '../favorites';

const note = {
  kind: 'note' as const,
  title: 'Receita de pão',
  text: 'Farinha, água e sal. Forno a 220 graus.',
  tags: ['cozinha/paes', 'casa'],
  folders: ['Casa', 'Cozinha'],
};
const task = { kind: 'task' as const, title: 'Comprar farinha', tags: ['mercado'], folders: ['Casa'] };

describe('parseSearch', () => {
  it('separa palavras, frase, exclusão e operadores (sem acento)', () => {
    expect(parseSearch('Pão "forno a" -bolo tag:Cozinha em:"Casa nova" tipo:nota')).toEqual({
      words: ['pao'],
      phrases: ['forno a'],
      exclude: ['bolo'],
      tags: ['cozinha'],
      folders: ['casa nova'],
      kinds: ['note'],
    });
  });

  it('operadores nos três idiomas e #etiqueta', () => {
    const q = parseSearch('label:x in:work type:task #lazer etiqueta:y carpeta:Hogar tipo:tarea');
    expect(q.tags).toEqual(['x', 'lazer', 'y']);
    expect(q.folders).toEqual(['work', 'hogar']);
    expect(q.kinds).toEqual(['task']);
  });

  it('"palavra:" que não é operador continua texto', () => {
    expect(parseSearch('Reunião: pauta').words).toEqual(['reuniao:', 'pauta']);
  });

  it('vazio e sem operador', () => {
    expect(isEmptySearch(parseSearch('   '))).toBe(true);
    expect(hasOperators(parseSearch('pão'))).toBe(false);
    expect(hasOperators(parseSearch('-pão'))).toBe(true);
  });
});

describe('matchSearch', () => {
  it('palavras no título ou no texto, sem acento', () => {
    expect(matchSearch(parseSearch('pao sal'), note)).toBe(true);
    expect(matchSearch(parseSearch('pao fermento'), note)).toBe(false);
  });

  it('frase exata e exclusão', () => {
    expect(matchSearch(parseSearch('"forno a 220"'), note)).toBe(true);
    expect(matchSearch(parseSearch('"a forno"'), note)).toBe(false);
    expect(matchSearch(parseSearch('farinha -forno'), note)).toBe(false);
    expect(matchSearch(parseSearch('farinha -forno'), task)).toBe(true);
  });

  it('etiqueta aninhada e exclusão de etiqueta', () => {
    expect(matchSearch(parseSearch('tag:cozinha'), note)).toBe(true);
    expect(matchSearch(parseSearch('#cozinha/paes'), note)).toBe(true);
    expect(matchSearch(parseSearch('tag:coz'), note)).toBe(false);
    expect(matchSearch(parseSearch('farinha -#mercado'), task)).toBe(false);
  });

  it('pasta (qualquer nível) e tipo', () => {
    expect(matchSearch(parseSearch('em:cozinha'), note)).toBe(true);
    expect(matchSearch(parseSearch('em:cozinha'), task)).toBe(false);
    expect(matchSearch(parseSearch('farinha tipo:tarefa'), note)).toBe(false);
    expect(matchSearch(parseSearch('farinha tipo:tarefa'), task)).toBe(true);
  });

  it('ordem: começa com, contém, só no texto', () => {
    const q = parseSearch('farinha');
    expect(searchRank(q, task)).toBe(1);
    expect(searchRank(q, note)).toBe(2);
    expect(searchRank(parseSearch('receita'), note)).toBe(0);
  });
});

describe('favoritos', () => {
  it('lê só o que tem forma de favorito, sem repetir', () => {
    expect(
      readFavorites([
        { kind: 'note', id: 'a' },
        { kind: 'note', id: 'a' },
        { kind: 'page' },
        { kind: 'search', query: '  tag:casa ' },
        'lixo',
        null,
      ]),
    ).toEqual([
      { kind: 'note', id: 'a' },
      { kind: 'search', query: 'tag:casa' },
    ]);
    expect(readFavorites(undefined)).toEqual([]);
  });

  it('liga e desliga, e tira os que sumiram', () => {
    let list = toggleFavorite([], { kind: 'page', id: 'p' });
    list = toggleFavorite(list, { kind: 'note', id: 'n' });
    expect(isFavorite(list, { kind: 'page', id: 'p' })).toBe(true);
    list = toggleFavorite(list, { kind: 'page', id: 'p' });
    expect(list).toEqual([{ kind: 'note', id: 'n' }]);
    expect(liveFavorites(list, () => false)).toEqual([]);
  });
});

describe('pickRandom', () => {
  it('escolhe pelo sorteio e aguenta lista vazia', () => {
    expect(pickRandom(['a', 'b', 'c'], () => 0.5)).toBe('b');
    expect(pickRandom(['a', 'b'], () => 0.9999999)).toBe('b');
    expect(pickRandom([], () => 0.3)).toBeUndefined();
  });
});
