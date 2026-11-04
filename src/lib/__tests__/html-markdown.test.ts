import { describe, expect, test } from '@jest/globals';

import { absoluteUrl, htmlToMarkdown, type MdNode } from '../html-markdown';

// DOM de mentira, com a forma que o conversor lê
type Child = MdNode | string;
const text = (t: string): MdNode => ({
  nodeType: 3,
  nodeName: '#text',
  textContent: t,
  childNodes: [],
});
function h(name: string, attrs: Record<string, string> = {}, ...kids: Child[]): MdNode {
  const childNodes = kids.map((k) => (typeof k === 'string' ? text(k) : k));
  return {
    nodeType: 1,
    nodeName: name.toUpperCase(),
    get textContent() {
      return childNodes.map((c) => c.textContent ?? '').join('');
    },
    childNodes,
    getAttribute: (n) => (n in attrs ? attrs[n] : null),
  };
}
const BASE = 'https://exemplo.com/receitas/bolo';
const md = (node: MdNode, max?: number) => htmlToMarkdown(node, BASE, max);

describe('página → Markdown (OB15)', () => {
  test('títulos, parágrafos, ênfase e quebra', () => {
    const page = h(
      'article',
      {},
      h('h1', {}, 'Bolo de ', h('em', {}, 'cenoura')),
      h('p', {}, '\n  Fácil e ', h('strong', {}, 'rápido'), '.', h('br'), 'Rende 8.  '),
      h('h3', {}, 'Dica'),
      h('p', {}, h('del', {}, 'velho'), ' ', h('mark', {}, 'novo'), ' ', h('code', {}, 'a`b')),
    );
    expect(md(page)).toBe(
      "# Bolo de *cenoura*\n\nFácil e **rápido**.\nRende 8.\n\n### Dica\n\n~~velho~~ ==novo== `a'b`",
    );
  });

  test('links e imagens absolutos; javascript, âncora e data: somem', () => {
    const page = h(
      'p',
      {},
      h('a', { href: '../massa' }, 'massa'),
      ' ',
      h('a', { href: 'javascript:alert(1)' }, 'mau'),
      ' ',
      h('a', { href: '#passo-2' }, 'passo'),
      ' ',
      h('img', { src: '/img/bolo (1).jpg', alt: 'Bolo [pronto]' }),
      h('img', { src: 'data:image/png;base64,xx' }),
    );
    expect(md(page)).toBe(
      '[massa](https://exemplo.com/massa) mau passo ![Bolo pronto](https://exemplo.com/img/bolo%20%281%29.jpg)',
    );
  });

  test('listas aninhadas e numeradas', () => {
    const page = h(
      'div',
      {},
      h(
        'ul',
        {},
        h('li', {}, 'Farinha'),
        h('li', {}, 'Ovos', h('ol', { start: '3' }, h('li', {}, 'a'), h('li', {}, 'b'))),
      ),
      h('p', {}, 'Fim'),
    );
    expect(md(page)).toBe('- Farinha\n- Ovos\n  3. a\n  4. b\n\nFim');
  });

  test('citação, código com linguagem e tabela', () => {
    const page = h(
      'div',
      {},
      h('blockquote', {}, h('p', {}, 'Um'), h('p', {}, 'Dois')),
      h('pre', {}, h('code', { class: 'language-js' }, 'let a = 1;\n')),
      h('pre', {}, h('code', { class: 'language-questlist' }, 'tarefas')),
      h(
        'table',
        {},
        h('tr', {}, h('th', {}, 'Item'), h('th', {}, 'Qtd')),
        h('tr', {}, h('td', {}, 'Ovo | caipira'), h('td', {}, '3')),
      ),
    );
    expect(md(page)).toBe(
      '> Um\n>\n> Dois\n\n```js\nlet a = 1;\n```\n\n```\ntarefas\n```\n\n| Item | Qtd |\n| --- | --- |\n| Ovo \\| caipira | 3 |',
    );
  });

  test('menu, rodapé, script, formulário e escondido ficam de fora', () => {
    const page = h(
      'body',
      {},
      h('nav', {}, 'Início'),
      h('script', {}, 'x()'),
      h('p', {}, 'Texto'),
      h('div', { hidden: '' }, 'oculto'),
      h('span', { 'aria-hidden': 'true' }, 'ícone'),
      h('form', {}, 'busca'),
      h('footer', {}, '© site'),
    );
    expect(md(page)).toBe('Texto');
  });

  test('"[[" de link e "![[" de incorporar viram texto comum', () => {
    expect(md(h('p', {}, 'veja [[Segredo]] e ![[x]]'))).toBe('veja [ [Segredo] ] e ![ [x] ]');
  });

  test('passou do teto: corta num parágrafo e marca', () => {
    const page = h(
      'div',
      {},
      ...Array.from({ length: 50 }, (_, i) => h('p', {}, `Parágrafo ${i} `.repeat(10))),
    );
    const out = md(page, 1000);
    expect(out.length).toBeLessThanOrEqual(1003);
    expect(out.endsWith('\n\n…')).toBe(true);
  });

  test('endereço absoluto', () => {
    expect(absoluteUrl('mailto:a@b.c', BASE)).toBe('mailto:a@b.c');
    expect(absoluteUrl('ftp://x', BASE)).toBeNull();
    expect(absoluteUrl(null, BASE)).toBeNull();
  });
});
