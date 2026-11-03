import { describe, expect, it } from '@jest/globals';

import { noteTags } from '../note-props';
import {
  exportVault,
  importVault,
  parseFrontmatter,
  safeFileName,
  toFrontmatter,
} from '../vault';
import { parseLinks } from '../wikilinks';

const ids = () => {
  let i = 0;
  return () => `00000000-0000-4000-8000-${String(++i).padStart(12, '0')}`;
};

describe('frontmatter', () => {
  it('lê valores, listas (as duas formas), texto em bloco e aspas', () => {
    const { props, body } = parseFrontmatter(
      [
        '---',
        'tags: [leitura, ficção]',
        'aliases:',
        '  - Livro',
        '  - "O livro"',
        'nota: 4.5',
        'lido: true',
        'data: 2026-11-03',
        'link: "[[Outra]]"',
        'resumo: |',
        '  linha 1',
        '  linha 2',
        'vazio:',
        '---',
        '# Título',
        'texto',
      ].join('\n'),
    );
    expect(props).toEqual({
      tags: ['leitura', 'ficção'],
      aliases: ['Livro', 'O livro'],
      nota: 4.5,
      lido: true,
      data: '2026-11-03',
      link: '[[Outra]]',
      resumo: 'linha 1\nlinha 2',
      vazio: null,
    });
    expect(body).toBe('# Título\ntexto');
  });

  it('sem frontmatter, o texto inteiro', () => {
    expect(parseFrontmatter('oi\n---\nnão é')).toEqual({ props: {}, body: 'oi\n---\nnão é' });
  });

  it('ida e volta', () => {
    const props = { tags: ['a', 'b/c'], nota: 3, ok: false, frase: 'tem: dois pontos', n: '42', v: null };
    expect(parseFrontmatter(toFrontmatter(props) + 'corpo')).toEqual({ props, body: 'corpo' });
    expect(toFrontmatter({})).toBe('');
  });
});

describe('importVault', () => {
  const files = [
    { path: 'Cofre/Receitas/Pão.md', text: '---\ntags: [cozinha]\n---\nVer [[Farinha]] e [[Inexistente]]. #casa' },
    { path: 'Cofre/Farinha.md', text: 'Usada no [[Pão|pão caseiro]] e em ![[Pão#Massa]].' },
    { path: 'Cofre/Imagens/foto.png', text: '' },
    { path: 'Cofre/.obsidian/app.md', text: 'config' },
    { path: 'Cofre/Antiga.md', text: 'Liga em [[Já existe]] e [[Receitas/Pão]]' },
  ];

  it('cada .md vira anotação, com o título do nome do arquivo e o frontmatter como propriedades', () => {
    const r = importVault(files, { newId: ids() });
    expect(r.notes.map((n) => n.title)).toEqual(['Pão', 'Farinha', 'Antiga']);
    expect(r.notes[0].props).toEqual({ tags: ['cozinha'] });
    expect(noteTags(r.notes[0].body, r.notes[0].props)).toEqual(['cozinha', 'casa']);
    expect(r.skippedFiles).toBe(2);
  });

  it('links pelo título (e pelo caminho) ganham o id; o que não existe fica apagado', () => {
    const r = importVault(files, {
      newId: ids(),
      existing: [{ id: '99999999-0000-4000-8000-000000000000', title: 'Já existe' }],
    });
    const [pao, farinha, antiga] = r.notes;
    const links = parseLinks(pao.body);
    expect(links.map((l) => [l.title, l.kind, l.id])).toEqual([
      ['Farinha', 'note', farinha.id],
      ['Inexistente', null, null],
    ]);
    const back = parseLinks(farinha.body);
    expect(back.map((l) => [l.title, l.id, l.embed, l.anchor])).toEqual([
      ['Pão', pao.id, false, null],
      ['Pão', pao.id, true, 'Massa'],
    ]);
    expect(parseLinks(antiga.body).map((l) => l.id)).toEqual([
      '99999999-0000-4000-8000-000000000000',
      pao.id,
    ]);
    expect(r.unresolved).toBe(1);
  });

  it('corta o texto grande demais e conta', () => {
    const r = importVault([{ path: 'x.md', text: 'a'.repeat(25000) }], { newId: ids() });
    expect(r.notes[0].body).toHaveLength(20000);
    expect(r.truncated).toBe(1);
  });
});

describe('exportVault', () => {
  it('um .md por anotação, na pasta, sem nome repetido, com os links pelo nome do arquivo', () => {
    const a = '00000000-0000-4000-8000-00000000000a';
    const b = '00000000-0000-4000-8000-00000000000b';
    const c = '00000000-0000-4000-8000-00000000000c';
    const task = '00000000-0000-4000-8000-0000000000ff';
    const files = exportVault(
      [
        {
          id: a,
          title: 'Pão: receita',
          body: `Ver [[Farinha|n:${b}]], ![[Farinha#Tipos|n:${b}]] e [[Comprar|t:${task}]]`,
          props: { tags: ['cozinha'] },
          dir: [],
        },
        { id: b, title: 'Farinha', body: `Volta: [[Pão nome velho|n:${a}]]`, props: {}, dir: ['Casa'] },
        { id: c, title: 'Farinha', body: '', props: {}, dir: ['Casa'] },
      ],
      { untitled: 'Sem título', resolve: (kind) => (kind === 'task' ? 'Comprar farinha' : null) },
    );
    expect(files.map((f) => f.path)).toEqual(['Pão receita.md', 'Casa/Farinha.md', 'Casa/Farinha (2).md']);
    expect(files[0].text).toBe(
      '---\ntags:\n  - cozinha\n---\nVer [[Farinha]], ![[Farinha#Tipos]] e Comprar farinha',
    );
    expect(files[1].text).toBe('Volta: [[Pão receita|Pão nome velho]]');
  });

  it('nome de arquivo seguro', () => {
    expect(safeFileName('a/b\\c:*?"<>|#^[x]', 'X')).toBe('a b c x');
    expect(safeFileName('   ', 'Sem título')).toBe('Sem título');
  });

  it('exportar e importar de novo mantém os links', () => {
    const a = '00000000-0000-4000-8000-00000000000a';
    const b = '00000000-0000-4000-8000-00000000000b';
    const files = exportVault(
      [
        { id: a, title: 'Um', body: `[[Dois|n:${b}]]`, props: { nota: 2 }, dir: [] },
        { id: b, title: 'Dois', body: 'fim', props: {}, dir: ['P'] },
      ],
      { untitled: '?' },
    );
    const r = importVault(files, { newId: ids() });
    expect(r.notes[0].props).toEqual({ nota: 2 });
    expect(parseLinks(r.notes[0].body)[0].id).toBe(r.notes[1].id);
  });
});
