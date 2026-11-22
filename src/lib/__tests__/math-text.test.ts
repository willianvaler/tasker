import { describe, expect, it } from '@jest/globals';

import {
  decodeTex,
  encodeTex,
  extractMath,
  inlineMath,
  MATH_SCHEME,
  splitMathBlocks,
} from '../math-text';

const tex = (s: string) => `[ƒ](${MATH_SCHEME}${encodeTex(s)})`;

describe('inlineMath', () => {
  it('fórmula na linha vira o link da fórmula', () => {
    expect(inlineMath('onde $\\tau$ é o torque')).toBe(`onde ${tex('\\tau')} é o torque`);
    expect(inlineMath('$r$ e $F$')).toBe(`${tex('r')} e ${tex('F')}`);
    expect(inlineMath('$f(x) = (a+b)$')).toBe(tex('f(x) = (a+b)'));
  });
  it('dinheiro e cifrão solto não viram fórmula', () => {
    expect(inlineMath('custa R$ 10')).toBe('custa R$ 10');
    expect(inlineMath('R$10 e R$20')).toBe('R$10 e R$20');
    expect(inlineMath('de $ 5 a $ 8')).toBe('de $ 5 a $ 8');
    expect(inlineMath('escapado \\$x$')).toBe('escapado \\$x$');
  });
  it('os parênteses vão codificados no destino do link', () => {
    expect(encodeTex('f(x)')).toBe('f%28x%29');
    expect(decodeTex(`${MATH_SCHEME}${encodeTex('\\sin(\\theta)')}`)).toBe('\\sin(\\theta)');
  });
});

describe('extractMath', () => {
  it('bloco em várias linhas, em uma linha e na linha', () => {
    const text = [
      'Torque:',
      '',
      '$$',
      '\\tau = rF\\, \\sin \\, \\theta',
      '$$',
      '',
      'e $$E = mc^2$$',
      '$$a+b$$',
      'fim $x$.',
    ].join('\n');
    const r = extractMath(text);
    expect(r.blocks).toEqual(['\\tau = rF\\, \\sin \\, \\theta', 'a+b']);
    const parts = splitMathBlocks(r.text, r.blocks);
    expect(parts.map((p) => p.kind)).toEqual(['markdown', 'math', 'markdown', 'math', 'markdown']);
    // $$ no meio da linha fica como na linha (o Obsidian também)
    expect(parts[2]).toEqual({ kind: 'markdown', text: `\ne ${'$$E = mc^2$$'}` });
    expect(parts[4]).toEqual({ kind: 'markdown', text: `fim ${tex('x')}.` });
  });
  it('código fica como está', () => {
    const text = ['```', '$$x$$ e $y$', '```', 'o `$z$` fica', '    $w$ recuado'].join('\n');
    expect(extractMath(text)).toEqual({ text, blocks: [] });
  });
  it('bloco sem fechar fica como texto', () => {
    const r = extractMath('$$\nx + 1\nsem fim');
    expect(r.blocks).toEqual([]);
    expect(splitMathBlocks(r.text, r.blocks)).toEqual([
      { kind: 'markdown', text: '$$\nx + 1\nsem fim' },
    ]);
  });
});
