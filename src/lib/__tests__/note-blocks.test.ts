import { describe, expect, it } from '@jest/globals';

import {
  applySlash,
  calloutType,
  filterSlash,
  noteOutline,
  outlineIndex,
  prepareMarkdown,
  slashQuery,
  splitCallouts,
  superscript,
  wordCount,
} from '../note-blocks';

describe('splitCallouts', () => {
  it('separa o callout do resto e tira o ">" do corpo', () => {
    const text = 'Antes\n\n> [!dica] Leve água\n> Garrafa de 1 L\n> **gelada**\n\nDepois';
    expect(splitCallouts(text)).toEqual([
      { kind: 'markdown', text: 'Antes\n' },
      {
        kind: 'callout',
        type: 'tip',
        title: 'Leve água',
        fold: null,
        body: 'Garrafa de 1 L\n**gelada**',
      },
      { kind: 'markdown', text: '\nDepois' },
    ]);
  });

  it('+ e - deixam recolhível; sem título fica vazio', () => {
    expect(splitCallouts('> [!WARNING]-\n> cuidado')).toEqual([
      { kind: 'callout', type: 'warning', title: '', fold: 'closed', body: 'cuidado' },
    ]);
    expect(splitCallouts('> [!faq]+ Por quê?')[0]).toMatchObject({
      type: 'question',
      fold: 'open',
      body: '',
    });
  });

  it('citação comum, cerca de código e [!x] no meio da citação não viram callout', () => {
    expect(splitCallouts('> só citação')).toEqual([{ kind: 'markdown', text: '> só citação' }]);
    const fenced = '```\n> [!nota] x\n```';
    expect(splitCallouts(fenced)).toEqual([{ kind: 'markdown', text: fenced }]);
    const inside = '> primeira\n> [!nota] x';
    expect(splitCallouts(inside)).toEqual([{ kind: 'markdown', text: inside }]);
  });

  it('nomes em três idiomas e desconhecido vira nota', () => {
    expect(calloutType('Atenção')).toBe('warning');
    expect(calloutType('peligro')).toBe('danger');
    expect(calloutType('éxito')).toBe('success');
    expect(calloutType('xyz')).toBe('note');
  });
});

describe('prepareMarkdown', () => {
  it('==destaque== vira link de marca, fora do código', () => {
    expect(prepareMarkdown('um ==dois== e `==três==`').text).toBe(
      'um [dois](questlistmark:) e `==três==`',
    );
    expect(prepareMarkdown('a == b == c').text).toBe('a == b == c');
    expect(prepareMarkdown('```\n==x==\n```').text).toBe('```\n==x==\n```');
  });

  it('notas de rodapé numeradas pela ordem da chamada; definição sai do texto', () => {
    const out = prepareMarkdown(
      'Fato[^b] e outro[^a].\n\n[^a]: Fonte A\n[^b]: Fonte B\n[^c]: Solta',
    );
    expect(out.text).toBe('Fato[¹](questlistfn:1) e outro[²](questlistfn:2).\n');
    expect(out.footnotes).toEqual([
      { id: 'b', number: 1, text: 'Fonte B' },
      { id: 'a', number: 2, text: 'Fonte A' },
      { id: 'c', number: 3, text: 'Solta' },
    ]);
  });

  it('#etiqueta vira link; título, número e código não', () => {
    expect(prepareMarkdown('## Casa\n#Treino/Perna e #2026 `#x` a#b').text).toBe(
      '## Casa\n[#Treino/Perna](questlisttag:treino%2Fperna) e #2026 `#x` a#b',
    );
  });

  it('chamada sem definição fica como está', () => {
    expect(prepareMarkdown('x[^9]').text).toBe('x[^9]');
    expect(superscript(12)).toBe('¹²');
  });
});

describe('noteOutline', () => {
  it('títulos fora do código e dos callouts, sem marcação', () => {
    const text =
      '# Plano\n\n```\n# não\n```\n\n> [!nota]\n> ## também não\n\n## Ver [[Mercado|n:1]] **já**';
    expect(noteOutline(text)).toEqual([
      { level: 1, text: 'Plano' },
      { level: 2, text: 'Ver Mercado já' },
    ]);
    expect(outlineIndex(text, 'ver mercado já')).toBe(1);
    expect(outlineIndex(text, 'também não')).toBe(-1);
  });
});

describe('wordCount', () => {
  it('conta palavras sem marcação, links pelo nome e sem o código', () => {
    expect(
      wordCount('## Título\n\n- [ ] comprar **pão** e [[Mercado|n:1]]\n\n```\nfora daqui\n```'),
    ).toBe(5);
    expect(wordCount('| A | B |\n| --- | --- |\n| um | dois |')).toBe(4);
    expect(wordCount('> [!dica] ==olá== mundo')).toBe(2);
    expect(wordCount('   ')).toBe(0);
  });
});

describe('comandos de barra', () => {
  it('reconhece "/" no começo da linha até o cursor', () => {
    expect(slashQuery('abc\n/tab', 8)).toEqual({ start: 4, query: 'tab' });
    expect(slashQuery('  /', 3)).toEqual({ start: 2, query: '' });
    expect(slashQuery('a/b', 3)).toBeNull();
    expect(slashQuery('/a b', 4)).toBeNull();
  });

  it('filtra sem acento, quem começa igual primeiro', () => {
    const items = [
      { id: 'list', names: ['Lista', 'list'] },
      { id: 'table', names: ['Tabela', 'table'] },
      { id: 'footnote', names: ['Nota de rodapé'] },
      { id: 'note', names: ['Callout de nota', 'nota'] },
    ];
    expect(filterSlash(items, 'ta').map((i) => i.id)).toEqual(['table']);
    expect(filterSlash(items, 'nota').map((i) => i.id)).toEqual(['footnote', 'note']);
    expect(filterSlash(items, 'rodape').map((i) => i.id)).toEqual(['footnote']);
    expect(filterSlash(items, '')).toHaveLength(4);
  });

  it('troca o comando pelo que ele insere e põe o cursor no lugar', () => {
    expect(applySlash('a\n/tit', 2, 6, 'heading')).toEqual({ text: 'a\n## ', caret: 5 });
    expect(applySlash('/dica', 0, 5, 'tip')).toEqual({ text: '> [!tip] ', caret: 9 });
    const table = applySlash('/tab', 0, 4, 'table', { column: 'Col' });
    expect(table.text).toBe('| Col 1 | Col 2 |\n| --- | --- |\n|  |  |');
    expect(table.caret).toBe(table.text.length - 5);
    expect(applySlash('/des', 0, 4, 'highlight')).toEqual({ text: '====', caret: 2 });
    expect(applySlash('texto\n/li', 6, 9, 'divider')).toEqual({
      text: 'texto\n\n---\n',
      caret: 11,
    });
  });

  it('nota de rodapé usa o próximo número e põe a definição no fim', () => {
    const out = applySlash('Já tem[^1]\n/ro\n\n[^1]: a', 11, 14, 'footnote');
    expect(out.text).toBe('Já tem[^1]\n[^2]\n\n[^1]: a\n\n[^2]: ');
    expect(out.caret).toBe(out.text.length);
  });
});
