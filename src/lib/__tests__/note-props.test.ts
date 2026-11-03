import { describe, expect, it } from '@jest/globals';

import {
  cleanPropName,
  cleanTag,
  convertProp,
  noteAliases,
  noteTags,
  propEntries,
  propType,
  tagMatches,
  tagTree,
} from '../note-props';

describe('noteTags (mesmos casos do pgTAP propriedades_anotacoes)', () => {
  it('texto e propriedade, sem código, número, link nem título', () => {
    expect(
      noteTags(
        '#Treino/Perna e #casa\n```\n#nao\n```\n`#nao2` x#nao3 #2026 #a//b/ ## titulo #ação',
        { tags: ['#Leitura', 'casa'] },
      ),
    ).toEqual(['leitura', 'casa', 'treino/perna', 'a/b', 'ação']);
  });
  it('tags em texto separado por vírgula', () => {
    expect(noteTags('oi', { tags: 'a, b ,#c' })).toEqual(['a', 'b', 'c']);
  });
  it('sem repetir; pontuação fecha', () => {
    expect(noteTags('#Casa e #casa, #fim.', {})).toEqual(['casa', 'fim']);
  });
  it('começo de linha conta; item que não é texto fica fora', () => {
    expect(
      noteTags('linha\n#começo da linha\ttab #x_y-z', {
        tags: [1, null, 'ok'] as unknown as string[],
      }),
    ).toEqual(['ok', 'começo', 'x_y-z']);
  });
  it('nada', () => {
    expect(noteTags('', {})).toEqual([]);
  });
});

describe('propriedades', () => {
  it('tipo pelo valor', () => {
    expect(propType(true)).toBe('checkbox');
    expect(propType(4)).toBe('number');
    expect(propType(['a'])).toBe('list');
    expect(propType('2026-11-03')).toBe('date');
    expect(propType('[[Livro|n:1]]')).toBe('link');
    expect(propType('qualquer')).toBe('text');
    expect(propType(null)).toBe('text');
  });

  it('converte aproveitando o valor', () => {
    expect(convertProp('4,5', 'number')).toBe(4.5);
    expect(convertProp('abc', 'number')).toBeNull();
    expect(convertProp('a, b', 'list')).toEqual(['a', 'b']);
    expect(convertProp(['a', 'b'], 'text')).toBe('a, b');
    expect(convertProp('sim', 'checkbox')).toBe(true);
    expect(convertProp('ontem', 'date')).toBe('');
    expect(convertProp('Livro', 'link')).toBe('[[Livro]]');
  });

  it('apelidos, nomes e ordem', () => {
    expect(noteAliases({ aliases: ['O livro', ' '] })).toEqual(['O livro']);
    expect(noteAliases({ aliases: 'a, b' })).toEqual(['a', 'b']);
    expect(noteAliases({})).toEqual([]);
    expect(cleanPropName('  nota  final ')).toBe('nota final');
    expect(cleanPropName('a:b')).toBeNull();
    expect(propEntries({ z: 1, aliases: [], a: 2, tags: [] }).map(([k]) => k)).toEqual([
      'tags',
      'aliases',
      'a',
      'z',
    ]);
  });
});

describe('etiquetas aninhadas', () => {
  it('limpa e filtra pela mãe', () => {
    expect(cleanTag('#Treino//Perna/')).toBe('treino/perna');
    expect(cleanTag('#2026')).toBeNull();
    expect(tagMatches('treino/perna', 'treino')).toBe(true);
    expect(tagMatches('treinos', 'treino')).toBe(false);
  });

  it('árvore conta cada item uma vez por nível', () => {
    expect(tagTree([['treino/perna', 'treino/braço'], ['treino'], ['casa']])).toEqual([
      { tag: 'casa', name: 'casa', count: 1, children: [] },
      {
        tag: 'treino',
        name: 'treino',
        count: 2,
        children: [
          { tag: 'treino/braço', name: 'braço', count: 1, children: [] },
          { tag: 'treino/perna', name: 'perna', count: 1, children: [] },
        ],
      },
    ]);
  });
});
