import { describe, expect, test } from '@jest/globals';

import { hostOf, sharedContent, sharedNotes } from '../shared-content';

describe('conteúdo compartilhado (PB8)', () => {
  test('Chrome do Android: título no assunto, link no texto', () => {
    const c = sharedContent({
      title: 'Receita de bolo - Site',
      text: 'https://exemplo.com/bolo?x=1',
    });
    expect(c).toEqual({
      title: 'Receita de bolo - Site',
      lines: [],
      url: 'https://exemplo.com/bolo?x=1',
    });
    expect(sharedNotes(c)).toBe('https://exemplo.com/bolo?x=1');
  });

  test('texto com título repetido e link no fim, com pontuação colada', () => {
    const c = sharedContent({
      title: 'Artigo',
      text: 'Artigo\nVale ler isto (https://exemplo.com/a).',
    });
    expect(c.url).toBe('https://exemplo.com/a');
    expect(c.lines).toEqual(['Vale ler isto.']);
  });

  test('só texto: a primeira linha é o título e as outras ficam', () => {
    const c = sharedContent({ text: 'Mercado\nleite\novos\n\npão' });
    expect(c).toEqual({ title: 'Mercado', lines: ['leite', 'ovos', 'pão'], url: null });
  });

  test('web instalada: url separada', () => {
    const c = sharedContent({ title: '', text: 'olha isso', url: 'https://exemplo.com/' });
    expect(c).toEqual({ title: 'olha isso', lines: [], url: 'https://exemplo.com/' });
  });

  test('só o link: o título é o site', () => {
    expect(sharedContent({ text: 'https://www.exemplo.com.br/x' }).title).toBe('exemplo.com.br');
    expect(hostOf('não é link')).toBeNull();
  });

  test('título longo é cortado em 200', () => {
    expect(sharedContent({ title: 'a'.repeat(300) }).title).toHaveLength(200);
  });
});
