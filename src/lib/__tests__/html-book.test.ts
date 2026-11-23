import { describe, expect, it } from '@jest/globals';

import { convertHtmlGroup, groupHtml, isInteractive, splitMarkdown } from '../html-book';
import { htmlToMarkdown } from '../html-markdown';
import { decodeEntities, htmlTitle, parseHtml } from '../html-parse';
import { buildMaterialImport, ignoredZipPath } from '../material-import';

const md = (html: string) =>
  htmlToMarkdown(parseHtml(html), 'https://x.invalid/b/p.html', Infinity);

describe('parseHtml', () => {
  it('lê o corpo com títulos, listas, tabela e entidades', () => {
    const html = `<!DOCTYPE html><html><head><title>Livro &amp; cia</title><style>p{}</style></head>
      <body><h1>Cap&iacute;tulo&nbsp;1</h1><p>Um <b>dois</b><p>tr&ecirc;s &#8212; &#x263A;
      <ul><li>a<li>b</ul><table><tr><td>x<td>y<tr><td>1<td>2</table>
      <script>if (a < b) document.write("<p>não</p>")</script><img src="i/f.jpg" alt="F"></body></html>`;
    expect(htmlTitle(html)).toBe('Livro & cia');
    expect(md(html)).toBe(
      '# Capítulo 1\n\nUm **dois**\n\ntrês — ☺\n\n- a\n- b\n\n| x | y |\n| --- | --- |\n| 1 | 2 |\n\n![F](https://x.invalid/b/i/f.jpg)',
    );
  });
  it('entidades com acento e desconhecidas', () => {
    expect(decodeEntities('&Atilde;o &ccedil; &foo; &amp;amp;')).toBe('Ão ç &foo; &amp;');
  });
  it('fechamento sem abertura e atributos sem aspas', () => {
    expect(md('<div></span><a href=q.html>ir</a></p></div>')).toBe(
      '[ir](https://x.invalid/b/q.html)',
    );
  });
  it('imagem dentro de link fica só a imagem', () => {
    expect(md('<a href="g.jpg"><img src="p.jpg" alt="Ventos"></a>')).toBe(
      '![Ventos](https://x.invalid/b/p.jpg)',
    );
  });
});

describe('HTML de estudo → anotações (ES5)', () => {
  it('simulador: só script, sem texto', () => {
    const html = '<html><body><script>var x = 1;</script><div id="sim"></div></body></html>';
    expect(isInteractive(html, md(html))).toBe(true);
    expect(
      isInteractive('<p>texto</p>'.repeat(100), md('<p>texto longo de verdade</p>'.repeat(30))),
    ).toBe(false);
    const c = convertHtmlGroup({
      name: '05 - PhET',
      dir: '',
      book: false,
      pages: [{ path: '05 - PhET.html', html }],
    });
    expect(c).toEqual({ files: [], mainTitle: null, interactive: true });
  });

  it('a pasta com index.html é um livro; os soltos são um material cada', () => {
    const groups = groupHtml([
      { path: 'mat/Livro/index.html', html: '' },
      { path: 'mat/Livro/cap2.html', html: '' },
      { path: 'mat/a.html', html: '' },
      { path: 'mat/b.html', html: '' },
    ]);
    expect(groups.map((g) => [g.name, g.pages.map((p) => p.path)])).toEqual([
      ['Livro', ['mat/Livro/index.html', 'mat/Livro/cap2.html']],
      ['a', ['mat/a.html']],
      ['b', ['mat/b.html']],
    ]);
  });

  it('livro de várias páginas: links entre páginas viram [[links]], imagem relativa, âncora vira texto, link de fora fica', () => {
    const c = convertHtmlGroup({
      name: 'Livro',
      dir: 'mat/Livro',
      book: true,
      pages: [
        {
          path: 'mat/Livro/index.html',
          html: '<p><a href="cap2.html#s1">Capítulo 2</a> <a href="#topo">topo</a> <a href="https://e.org/">site</a></p><img src="img/a%20b.png" alt="A">',
        },
        {
          path: 'mat/Livro/cap2.html',
          html: '<title>Segundo</title><p>Volta ao <a href="index.html">início</a></p>',
        },
      ],
    });
    expect(c.mainTitle).toBe('Livro');
    expect(c.files).toEqual([
      {
        path: 'mat/Livro/Livro.md',
        text: '[[Livro · Segundo|Capítulo 2]] topo [site](https://e.org/)\n\n![A](<img/a b.png>)',
      },
      { path: 'mat/Livro/Livro · Segundo.md', text: 'Volta ao [[Livro|início]]' },
    ]);
  });

  it('página longa vira sumário e partes, cortadas nos títulos, com anterior e próxima', () => {
    const body = ['Um', 'Dois', 'Três']
      .map((t) => `<h2>CHAPTER ${t}</h2><h3>Assunto ${t}</h3><p>${'palavra '.repeat(120)}</p>`)
      .join('');
    const c = convertHtmlGroup({
      name: 'Vitrúvio',
      dir: '',
      book: false,
      pages: [{ path: 'index.html', html: body }],
    });
    // Cada parte passa de 900 caracteres; com o teto de 18 mil cabem todas numa só
    expect(c.files).toHaveLength(1);
    const parts = splitMarkdown(md(body), 1000);
    expect(parts).toHaveLength(3);
    expect(parts[1].startsWith('## CHAPTER Dois')).toBe(true);
  });

  it('partes: títulos, navegação e o sumário', () => {
    const body = Array.from(
      { length: 3 },
      (_, i) => `<h2>Parte ${i}</h2><p>${'x'.repeat(9000)}</p>`,
    ).join('');
    const c = convertHtmlGroup({
      name: 'L (livro)',
      dir: '',
      book: false,
      pages: [{ path: 'index.html', html: body }],
    });
    expect(c.files.map((f) => f.path)).toEqual([
      'L · 01 Parte 0.md',
      'L · 02 Parte 1.md',
      'L · 03 Parte 2.md',
      'L (livro).md',
    ]);
    expect(
      c.files[1].text.endsWith(
        '← [[L · 01 Parte 0|anterior]] · [[L (livro)|sumário]] · [[L · 03 Parte 2|próxima]] →',
      ),
    ).toBe(true);
    expect(c.files[3].text).toBe(
      '- [[L · 01 Parte 0]]\n- [[L · 02 Parte 1]]\n- [[L · 03 Parte 2]]',
    );
  });

  it('parágrafo maior que a parte é cortado', () => {
    const parts = splitMarkdown('y'.repeat(2500), 1000);
    expect(parts.map((p) => p.length)).toEqual([1000, 1000, 500]);
  });
});

describe('Adicionar material: o que entra', () => {
  it('md, HTML com texto, livro e simulador', () => {
    const r = buildMaterialImport({
      markdown: [{ path: 'mat/04 - M01 - Equilíbrio.md', text: 'Ver [[Torque]]' }],
      html: [
        { path: 'mat/05 - PhET.html', text: '<script>sim()</script>' },
        { path: 'mat/12 - Aqueduto.html', text: '<h1>Aqueduto</h1><p>Texto do artigo.</p>' },
        { path: 'mat/06 - Vitrúvio/index.html', text: '<p>Livro</p>' },
      ],
    });
    expect(r.interactive).toEqual([{ path: 'mat/05 - PhET.html', name: '05 - PhET.html' }]);
    expect(r.mains).toEqual([
      { title: '04 - M01 - Equilíbrio', name: '04 - M01 - Equilíbrio.md' },
      { title: '12 - Aqueduto', name: '12 - Aqueduto.html' },
      { title: '06 - Vitrúvio', name: '06 - Vitrúvio' },
    ]);
    expect(r.vault.map((f) => f.path)).toEqual([
      'mat/04 - M01 - Equilíbrio.md',
      'mat/12 - Aqueduto.md',
      'mat/06 - Vitrúvio/06 - Vitrúvio.md',
    ]);
  });
  it('o que o .zip ignora', () => {
    expect(
      ['a/', '__MACOSX/a.md', 'c/.obsidian/x.json', 'c/.DS_Store', 'c/a.md'].filter(
        (p) => !ignoredZipPath(p),
      ),
    ).toEqual(['c/a.md']);
  });
});

describe('.md longo vira sumário e partes (CD45)', () => {
  it('as propriedades ficam no sumário; o curto vai inteiro', () => {
    const long = `---\ntags: [estudo]\n---\n${['Um', 'Dois'].map((t) => `## ${t}\n\n${'z'.repeat(12000)}`).join('\n')}`;
    const r = buildMaterialImport({
      markdown: [{ path: 'mat/23 - M14 - Exercícios.md', text: long }],
      html: [],
    });
    expect(r.vault.map((f) => f.path)).toEqual([
      'mat/23 - M14 - Exercícios · 01 Um.md',
      'mat/23 - M14 - Exercícios · 02 Dois.md',
      'mat/23 - M14 - Exercícios.md',
    ]);
    expect(
      r.vault[2].text.startsWith('---\ntags: [estudo]\n---\n- [[23 - M14 - Exercícios · 01 Um]]'),
    ).toBe(true);
    expect(r.vault[0].text.startsWith('## Um')).toBe(true);
    expect(r.mains).toEqual([{ title: '23 - M14 - Exercícios', name: '23 - M14 - Exercícios.md' }]);
    const short = buildMaterialImport({ markdown: [{ path: 'a.md', text: 'curto' }], html: [] });
    expect(short.vault).toEqual([{ path: 'a.md', text: 'curto' }]);
  });
});
