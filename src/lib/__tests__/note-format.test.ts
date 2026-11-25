import { describe, expect, test } from '@jest/globals';

import {
  blocoPorId,
  blocos,
  conteudoDaCerca,
  garantirIdBloco,
  lerBotao,
  mesclarPorBloco,
  normalizar,
  semIdBloco,
  textoDoBloco,
} from '@/lib/note-format';

import { semente } from './fixtures/notas-geradas';

// Sem @types/node no projeto: o Jest roda no Node, então o require existe
declare const require: (id: string) => unknown;

/** Remonta o texto pelos blocos e pelo que fica entre eles (que precisa ser só espaço). */
function remontar(md: string) {
  const bs = blocos(md);
  let out = '';
  let pos = 0;
  for (const b of bs) {
    const entre = md.slice(pos, b.inicio);
    expect(entre.trim()).toBe('');
    expect(b.inicio).toBeGreaterThanOrEqual(pos);
    out += entre + textoDoBloco(md, b);
    pos = b.fim;
  }
  expect(md.slice(pos).trim()).toBe('');
  return out + md.slice(pos);
}

const PEDACOS = [
  '# Título',
  '## Sub ^t1',
  'texto simples',
  'texto com ^idx',
  '- a\n- b\n  - c',
  '1. um\n2. dois',
  '- [ ] x',
  '> cit\n> ação',
  '> [!tip] T\n> corpo',
  '| a | b |\n| - | - |\n| 1 | 2 |',
  '```\ncódigo\n```',
  '```ts\nx\n```\n^c1',
  '~~~\nnão fecha',
  '$$\nx^2\n$$',
  '$$ a $$',
  '```questlist\nnotas\n```',
  '```questlist-button\n{"rotulo":"B","acao":{"tipo":"parar"}}\n```',
  '---',
  '***',
  '[[L|n:00000000-0000-4000-8000-000000000001]]',
  '![[E]]',
  '<div>html</div>',
  '   ',
  '\t',
  'ç ã é 🙂',
  'linha\r\nwindows',
  '[^1]: rodapé',
  '^solto',
  '| sem fim',
  '```',
  '',
  'a ^',
  'b ^ok-1',
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

describe('formato das anotações (ED1)', () => {
  const entradas = fuzz(1000, 2026);

  test('mil entradas aleatórias: remontar pelos blocos dá o texto idêntico', () => {
    for (const md of entradas) expect(remontar(md)).toBe(md);
  });

  test('ler de novo dá os mesmos blocos (estável)', () => {
    for (const md of entradas) expect(blocos(remontar(md))).toEqual(blocos(md));
  });

  test('pôr o ID num bloco não mexe em nenhum outro', () => {
    let k = 0;
    for (const md of entradas.slice(0, 300)) {
      const antes = blocos(md);
      antes.forEach((b, i) => {
        if (b.id) return;
        const r = garantirIdBloco(md, i, () => `id${k++}`);
        // Cerca que não fecha não ganha ID (ele cairia dentro do código)
        if (b.aberto) return expect(r).toBeNull();
        expect(r).not.toBeNull();
        if (!r) return;
        const depois = blocos(r.md);
        const alvo = blocoPorId(r.md, r.id);
        expect(alvo).toBeDefined();
        // Os outros blocos continuam com o mesmo texto
        const outros = (bs: typeof antes, texto: string, sem: number) =>
          bs.filter((_, j) => j !== sem).map((x) => textoDoBloco(texto, x));
        expect(
          outros(
            depois,
            r.md,
            depois.findIndex((x) => x.id === r.id),
          ),
        ).toEqual(outros(antes, md, i));
        expect(semIdBloco(textoDoBloco(r.md, alvo!)).trimEnd()).toBe(
          textoDoBloco(md, b).replace(/\r$/, '').trimEnd(),
        );
      });
    }
  });

  test('bloco que já tem ID devolve o mesmo, sem escrever', () => {
    const md = 'texto ^abc\n\noutro';
    expect(garantirIdBloco(md, 0)).toEqual({ md, id: 'abc' });
  });

  test.each([
    ['parágrafo', 'linha um\nlinha dois ^p1', { tipo: 'paragrafo', id: 'p1' }],
    [
      'código com ID na linha de baixo',
      '```ts\nx\n```\n^c1',
      { tipo: 'codigo', id: 'c1', linguagem: 'ts' },
    ],
    ['botão', '```questlist-button\n{}\n```', { tipo: 'botao', linguagem: 'questlist-button' }],
    ['consulta', '```questlist\nnotas\n```', { tipo: 'consulta' }],
    ['lista', '- a\n  continua\n- b ^l', { tipo: 'lista', id: 'l' }],
    ['cabeçalho de dados', '---\na: 1\n---\ntexto', { tipo: 'propriedades' }],
  ])('%s', (_n, md, esperado) => expect(blocos(md)[0]).toMatchObject(esperado));

  test('construção desconhecida fica como parágrafo, idêntica', () => {
    const md = '{{% shortcode %}}\n<details>x</details>';
    expect(blocos(md)).toHaveLength(1);
    expect(textoDoBloco(md, blocos(md)[0])).toBe(md);
  });

  test('normalizar só troca o fim de linha, e é idempotente', () => {
    expect(normalizar('a\r\nb\rc\n')).toBe('a\nb\nc\n');
    for (const md of entradas.slice(0, 200))
      expect(normalizar(normalizar(md))).toBe(normalizar(md));
  });

  test('botão: JSON válido com rótulo e ação; o resto não é botão', () => {
    expect(
      lerBotao('{"rotulo":"Ir","acao":{"tipo":"criar_tarefa","titulo":"x"},"confirmar":true}'),
    ).toEqual({
      rotulo: 'Ir',
      acao: { tipo: 'criar_tarefa', titulo: 'x' },
      confirmar: true,
    });
    expect(lerBotao('{"rotulo":"","acao":{"tipo":"x"}}')).toBeNull();
    expect(lerBotao('não é json')).toBeNull();
    expect(conteudoDaCerca('```questlist-button\n{"a":1}\n```')).toBe('{"a":1}');
  });

  test('corpus fixo (tests/fixtures/notas): cada anotação volta idêntica', () => {
    const fs = require('fs') as {
      readdirSync: (p: string) => string[];
      readFileSync: (p: string, e: string) => string;
    };
    const dir = 'tests/fixtures/notas';
    const arquivos = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md');
    expect(arquivos.length).toBeGreaterThan(0);
    for (const f of arquivos) {
      const md = fs.readFileSync(`${dir}/${f}`, 'utf8');
      expect(remontar(md)).toBe(md);
    }
  });
});

describe('mesclar por bloco (ED6)', () => {
  test('nenhum bloco das duas versões se perde, na ordem', () => {
    const base = '# Lista\n\nComprar pão\n\nPagar a luz';
    const minha = '# Lista\n\nComprar pão\n\nLigar para a Ana\n\nPagar a luz';
    const outra = '# Lista\n\nComprar pão e leite\n\nPagar a luz\n\nMarcar o médico';
    const m = mesclarPorBloco(minha, outra);
    expect(m).toBe(
      '# Lista\n\nComprar pão e leite\n\nComprar pão\n\nLigar para a Ana\n\nPagar a luz\n\nMarcar o médico',
    );
    for (const t of [
      ...blocos(minha).map((b) => textoDoBloco(minha, b)),
      ...blocos(outra).map((b) => textoDoBloco(outra, b)),
    ])
      expect(m).toContain(t);
    expect(base).toBeDefined();
  });

  test('versões iguais: nada muda', () => {
    expect(mesclarPorBloco('a\n\nb', 'a\n\nb')).toBe('a\n\nb');
  });

  test('mil pares aleatórios: todo bloco das duas aparece no resultado', () => {
    const r = semente(7);
    const pedacos = [
      'um',
      'dois',
      'três',
      '- lista',
      '# título',
      '```\ncódigo\n```',
      'quatro ^id1',
      '> cit',
    ];
    for (let n = 0; n < 1000; n++) {
      const gera = () =>
        Array.from(
          { length: 1 + Math.floor(r() * 6) },
          () => pedacos[Math.floor(r() * pedacos.length)],
        ).join('\n\n');
      const a = gera();
      const b = gera();
      const m = mesclarPorBloco(a, b);
      const textos = new Set(blocos(m).map((x) => textoDoBloco(m, x)));
      for (const md of [a, b])
        for (const x of blocos(md)) expect(textos.has(textoDoBloco(md, x))).toBe(true);
    }
  });
});
