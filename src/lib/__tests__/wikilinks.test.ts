import { describe, expect, it } from '@jest/globals';

import {
  applyLink,
  cleanLinkTitle,
  findMention,
  headingKey,
  headings,
  linkContext,
  linkMarkup,
  linkMention,
  linkQuery,
  parseLinkHref,
  parseLinks,
  resolveTitleLinks,
  wikiToMarkdown,
} from '../wikilinks';

const A = 'e0000000-0000-0000-0000-000000000001';
const P = 'bbbbbbbb-0000-0000-0000-000000000001';

// Os mesmos casos de supabase/tests/links.test.sql (espelho do servidor)
const DIARY =
  `# Hoje\n- [ ] ver [[Ideias|n:${A}]] e [[Mercado#Frutas|p:${P}]]\n` +
  `Escrever [[Nova ideia]] e [[Outra|apelido]]\n![[Ideias|n:${A}]]\n\`[[\` sozinho não conta`;

describe('parseLinks', () => {
  it('acha os links como o servidor', () => {
    const links = parseLinks(DIARY);
    expect(links).toHaveLength(5);
    expect(links[0]).toMatchObject({ title: 'Ideias', kind: 'note', id: A, embed: false });
    expect(links[1]).toMatchObject({ title: 'Mercado', kind: 'page', id: P, anchor: 'Frutas' });
    expect(links[2]).toMatchObject({ title: 'Nova ideia', kind: null, id: null });
    expect(links[3]).toMatchObject({ title: 'Outra', alias: 'apelido', id: null });
    expect(links[4]).toMatchObject({ embed: true, kind: 'note' });
    expect(DIARY.slice(links[0].start, links[0].end)).toBe(`[[Ideias|n:${A}]]`);
  });

  it('ignora título vazio e texto sem link', () => {
    expect(parseLinks('nada [[ ]] aqui')).toEqual([]);
    expect(parseLinks('sem colchetes')).toEqual([]);
  });
});

describe('linkContext', () => {
  it('tira a marcação, a caixinha e o começo de linha', () => {
    expect(linkContext(`- [ ] ver [[Ideias|n:${A}]] e [[Mercado#Frutas|p:${P}]]`)).toBe(
      'ver Ideias e Mercado',
    );
    expect(linkContext(`> [!dica] leia [[A#b|n:${A}]] já`)).toBe('[!dica] leia A já');
    expect(linkContext('1. [[Só]]')).toBe('Só');
  });
});

describe('marcação', () => {
  it('monta o link com o id e limpa o título', () => {
    expect(linkMarkup('Ideias', 'note', A)).toBe(`[[Ideias|n:${A}]]`);
    expect(linkMarkup('A [b] | c # d', 'task', A, 'Seção')).toBe(`[[A b c d#Seção|t:${A}]]`);
    expect(cleanLinkTitle('  ')).toBe('…');
  });

  it('acha o "[[" aberto antes do cursor', () => {
    expect(linkQuery('ver [[Ide', 9)).toEqual({ start: 4, query: 'Ide' });
    expect(linkQuery('ver [[]] x', 10)).toBeNull();
    expect(linkQuery('[[a\nb', 5)).toBeNull();
    expect(linkQuery('sem', 3)).toBeNull();
  });

  it('troca a consulta pelo link e come o "]]" que já estava', () => {
    const markup = linkMarkup('Ideias', 'note', A);
    expect(applyLink('ver [[Ide]] já', 4, 9, markup)).toEqual({
      text: `ver ${markup} já`,
      caret: 4 + markup.length,
    });
    expect(applyLink('[[', 0, 2, markup).text).toBe(markup);
  });
});

describe('wikiToMarkdown', () => {
  const titles: Record<string, string | null> = { [A]: 'Ideias novas', [P]: null };
  const resolve = (_kind: string, id: string) => titles[id];

  it('vira link do Markdown com o título de agora', () => {
    expect(wikiToMarkdown(`ver [[Ideias|n:${A}]]`, resolve, '(sem acesso)')).toBe(
      `ver [Ideias novas](questlist-link:n:${A})`,
    );
  });

  it('sem acesso, sem título; o que não existe vai pelo título', () => {
    expect(wikiToMarkdown(`[[Mercado|p:${P}]]`, resolve, '(sem acesso)')).toBe(
      '[(sem acesso)](questlist-link:none:)',
    );
    expect(wikiToMarkdown('[[Nova ideia#Parte 1]]', resolve, '-')).toBe(
      '[Nova ideia › Parte 1](questlist-link:new:Nova%20ideia#Parte%201)',
    );
    expect(wikiToMarkdown('[[Outra|apelido]]', resolve, '-')).toBe(
      '[apelido](questlist-link:new:Outra)',
    );
  });

  it('não mexe dentro de código e escapa o texto do link', () => {
    expect(wikiToMarkdown('`[[A]]` e\n```\n[[B]]\n```', resolve, '-')).toBe(
      '`[[A]]` e\n```\n[[B]]\n```',
    );
    expect(wikiToMarkdown('[[a_b*c]]', resolve, '-')).toBe('[a\\_b\\*c](questlist-link:new:a_b*c)');
  });

  it('o endereço volta a ser o destino', () => {
    expect(parseLinkHref(`questlist-link:n:${A}#Parte%201`)).toEqual({
      kind: 'note',
      id: A,
      anchor: 'Parte 1',
    });
    expect(parseLinkHref('questlist-link:new:Nova%20ideia')).toEqual({
      kind: 'new',
      title: 'Nova ideia',
      anchor: null,
    });
    expect(parseLinkHref('questlist-link:none:')).toEqual({ kind: 'none' });
    expect(parseLinkHref('https://x.com')).toBeNull();
  });
});

describe('ligar pelo título', () => {
  it('os [[Título]] sem id ganham o id', () => {
    expect(
      resolveTitleLinks('[[nova ideia]] e ![[Nova Ideia#x]] e [[Outra]]', 'Nova ideia', 'note', A),
    ).toBe(`[[nova ideia|n:${A}]] e ![[Nova Ideia#x|n:${A}]] e [[Outra]]`);
    expect(resolveTitleLinks('nada', 'X', 'note', A)).toBe('nada');
  });

  it('acha a menção sem link, palavra inteira, fora dos links', () => {
    expect(findMention('Li sobre ideias hoje', 'Ideias')).toBe(9);
    expect(findMention('Ideiaslegais', 'Ideias')).toBe(-1);
    expect(findMention(`[[Ideias|n:${A}]] só`, 'Ideias')).toBe(-1);
    expect(findMention('Café da manhã', 'café')).toBe(0);
    expect(findMention('a', 'a')).toBe(-1);
  });

  it('"Ligar" troca a primeira menção pelo link, como estava escrito', () => {
    expect(linkMention('Li sobre ideias e ideias', 'Ideias', 'note', A)).toBe(
      `Li sobre [[ideias|n:${A}]] e ideias`,
    );
  });
});

describe('âncoras', () => {
  it('lista os títulos fora do código e compara sem formatação', () => {
    expect(headings(`# Um\ntexto\n\`\`\`\n# não\n\`\`\`\n## **Dois** [[X|n:${A}]]`)).toEqual([
      'Um',
      `**Dois** X`,
    ]);
    expect(headingKey('**Dois** X')).toBe(headingKey('dois x'));
  });
});
