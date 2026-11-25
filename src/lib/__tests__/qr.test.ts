import { describe, expect, it } from '@jest/globals';

import { qrMatrix, qrPath, qrSvg } from '../qr';

describe('QR do link de automação', () => {
  const url = `https://questlist.wavdev.org/r/${'a'.repeat(64)}`;

  it('gera uma matriz quadrada com os padrões de posição nos cantos', () => {
    const m = qrMatrix(url);
    const n = m.length;
    expect(n).toBeGreaterThanOrEqual(21);
    expect(m.every((row) => row.length === n)).toBe(true);
    // O canto de cima à esquerda é o quadrado 7x7: borda escura e anel claro
    for (let i = 0; i < 7; i++) {
      expect(m[0][i]).toBe(true);
      expect(m[6][i]).toBe(true);
      expect(m[i][0]).toBe(true);
    }
    expect(m[1][1]).toBe(false);
    expect(m[3][3]).toBe(true);
  });

  it('é determinístico para o mesmo texto e muda com o texto', () => {
    expect(qrPath(qrMatrix(url))).toBe(qrPath(qrMatrix(url)));
    expect(qrPath(qrMatrix(url))).not.toBe(qrPath(qrMatrix(url.replace(/a$/, 'b'))));
  });

  it('o caminho cobre exatamente os módulos escuros', () => {
    const m = qrMatrix(url);
    const dark = m.flat().filter(Boolean).length;
    const width = [...qrPath(m, 0).matchAll(/h(\d+)v1/g)].reduce((s, x) => s + Number(x[1]), 0);
    expect(width).toBe(dark);
  });

  it('o SVG para imprimir tem fundo branco e o tamanho pedido', () => {
    const svg = qrSvg(url, { light: 'white', dark: 'black' }, 300);
    expect(svg).toContain('width="300"');
    expect(svg).toContain('fill="white"');
    expect(svg.startsWith('<svg')).toBe(true);
  });
});
