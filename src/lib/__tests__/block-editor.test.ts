import { describe, expect, test } from '@jest/globals';

import { docToMarkdown, editorSchema, markdownToDoc, type EditorJSON } from '@/lib/block-editor/markdown';

import { semente } from './fixtures/notas-geradas';

declare const require: (id: string) => unknown;
const fs = require('fs') as { readFileSync(p: string, e: string): string; readdirSync(p: string): string[] };

const roundTrip = (md: string) => {
  const { doc, tail } = markdownToDoc(md);
  // Passa pelo esquema de verdade (o que o editor faria ao abrir)
  const node = editorSchema().nodeFromJSON(doc);
  return docToMarkdown(node, tail);
};

const PEDACOS = [
  '# Título', '## Sub ^t1', 'texto simples', 'texto com ^idx', '- a\n- b\n  - c', '1. um\n2. dois',
  '- [ ] x', '> cit\n> ação', '> [!tip] T\n> corpo', '| a | b |\n| - | - |\n| 1 | 2 |', '```\ncódigo\n```',
  '```ts\nx\n```\n^c1', '~~~\nnão fecha', '$$\nx^2\n$$', '$$ a $$', '```questlist\nnotas\n```',
  '```questlist-button\n{"rotulo":"B","acao":{"tipo":"parar"}}\n```', '---', '***',
  '[[L|n:00000000-0000-4000-8000-000000000001]]', '![[E]]', '<div>html</div>', '   ', '\t', 'ç ã é 🙂',
  'linha\r\nwindows', '[^1]: rodapé', '^solto', '| sem fim', '```', '', 'a ^', 'b ^ok-1',
  '**negrito** e _itálico_ e ==marca== e `c` e $x^2$ e R$ 10 e #casa/obra',
  '![foto](qlimg:n/abc.png) texto', '- [x] feito\n- [ ] não', '* asterisco\n* outro', '+ mais',
  'snake_case e 2*3', '1) parêntese', 'Setext\n===', '    indentado',
];

function fuzz(n: number, seed: number): string[] {
  const r = semente(seed);
  return Array.from({ length: n }, () => {
    const partes = Array.from({ length: 1 + Math.floor(r() * 12) }, () => {
      if (r() < 0.1) return String.fromCharCode(32 + Math.floor(r() * 400));
      return PEDACOS[Math.floor(r() * PEDACOS.length)];
    });
    const sep = () => ['\n', '\n\n', '\n\n\n', '\r\n', ' \n'][Math.floor(r() * 5)];
    return partes.reduce((acc, p, i) => (i === 0 ? p : acc + sep() + p), '');
  });
}

describe('editor de blocos: ida e volta sem perda (R1.1, D370)', () => {
  test('o corpus de anotações abre e salva idêntico', () => {
    const dir = 'tests/fixtures/notas';
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
      const md = fs.readFileSync(`${dir}/${f}`, 'utf8');
      expect(roundTrip(md)).toBe(md);
    }
  });

  test('mil entradas aleatórias abrem e salvam idênticas', () => {
    for (const md of fuzz(1000, 2026)) expect(roundTrip(md)).toBe(md);
  });

  test('texto vazio e só espaços', () => {
    expect(roundTrip('')).toBe('');
    expect(roundTrip('\n\n  \n')).toBe('\n\n  \n');
  });
});

describe('editor de blocos: o que cada bloco vira', () => {
  const tipos = (md: string) => (markdownToDoc(md).doc.content ?? []).map((n) => n.type);
  test('blocos conhecidos viram nós do editor; o resto, bloco cru', () => {
    expect(
      tipos(
        [
          '# T',
          'p **b**',
          '- a',
          '- [ ] t',
          '1. n',
          '> q',
          '> [!tip] Dica\n> corpo',
          '```ts\nx\n```',
          '---',
          '| a |\n| - |\n| 1 |',
          '$$\nx\n$$',
          '```questlist\nnotas\n```',
          '![[Outra]]',
          '<div>x</div>',
        ].join('\n\n'),
      ),
    ).toEqual([
      'heading',
      'paragraph',
      'bulletList',
      'taskList',
      'orderedList',
      'blockquote',
      'callout',
      'codeBlock',
      'horizontalRule',
      'table',
      'rawBlock',
      'rawBlock',
      'rawBlock',
      'rawBlock',
    ]);
  });

  test('link, fórmula, etiqueta e imagem ficam como trechos crus na linha', () => {
    const p = markdownToDoc(
      'Ver [[Plano|n:00000000-0000-4000-8000-000000000001]] e $x^2$ #casa ![f](qlimg:n/a.png)',
    ).doc.content?.[0] as EditorJSON;
    const kinds = (p.content ?? []).filter((n) => n.type === 'rawInline').map((n) => n.attrs?.kind);
    expect(kinds).toEqual(['link', 'formula', 'etiqueta', 'imagem']);
  });
});

describe('editor de blocos: editar muda só o bloco editado', () => {
  const edit = (md: string, i: number, change: (n: EditorJSON) => EditorJSON) => {
    const { doc, tail } = markdownToDoc(md);
    const content = [...(doc.content ?? [])];
    content[i] = change(content[i]);
    return docToMarkdown(editorSchema().nodeFromJSON({ ...doc, content }), tail);
  };

  test('mexer no parágrafo reescreve só ele; o resto fica byte a byte', () => {
    const md = '* item com asterisco\n\nvelho\n\n```questlist\nnotas\n```\n';
    const out = edit(md, 1, (n) => ({ ...n, content: [{ type: 'text', text: 'novo' }] }));
    expect(out).toBe('* item com asterisco\n\nnovo\n\n```questlist\nnotas\n```\n');
  });

  test('o que se digita como texto não vira outra coisa, e [[link]] e #etiqueta continuam valendo', () => {
    const out = edit('a', 0, (n) => ({
      ...n,
      content: [{ type: 'text', text: '# não é título, 2*3 e [[Outra]] #casa' }],
    }));
    expect(out).toBe('\\# não é título, 2\\*3 e [[Outra]] #casa');
  });

  test('tarefa marcada, callout e tabela são escritos no formato do app', () => {
    expect(
      edit('- [ ] comprar', 0, (n) => ({
        ...n,
        content: n.content?.map((i) => ({ ...i, attrs: { ...i.attrs, checked: true } })),
      })),
    ).toBe('- [x] comprar');
    expect(
      edit('> [!tip] Dica\n> corpo', 0, (n) => ({ ...n, attrs: { ...n.attrs, kind: 'warning' } })),
    ).toBe('> [!warning] Dica\n> corpo');
    expect(
      edit('| a | b |\n| --- | --- |\n| 1 | 2 |', 0, (n) => {
        const json = JSON.stringify(n).replace('"text":"1"', '"text":"um"');
        return JSON.parse(json) as EditorJSON;
      }),
    ).toBe('| a | b |\n| --- | --- |\n| um | 2 |');
  });
});
