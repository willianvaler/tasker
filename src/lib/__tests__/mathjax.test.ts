import { describe, expect, it } from '@jest/globals';

import { createConverter, setConverter, texToSvg } from '../mathjax';

/* eslint-disable @typescript-eslint/no-require-imports */
setConverter(
  createConverter({
    mathjax: require('mathjax-full/js/mathjax.js').mathjax,
    TeX: require('mathjax-full/js/input/tex.js').TeX,
    SVG: require('mathjax-full/js/output/svg.js').SVG,
    liteAdaptor: require('mathjax-full/js/adaptors/liteAdaptor.js').liteAdaptor,
    RegisterHTMLHandler: require('mathjax-full/js/handlers/html.js').RegisterHTMLHandler,
    AllPackages: require('mathjax-full/js/input/tex/AllPackages.js').AllPackages,
  }),
);

describe('texToSvg', () => {
  it('desenha a fórmula em SVG, com o tamanho em ex', async () => {
    const r = await texToSvg('\\tau = rF\\, \\sin \\, \\theta', true);
    expect(r?.svg.startsWith('<svg')).toBe(true);
    expect(r?.widthEx).toBeGreaterThan(5);
    expect(r?.heightEx).toBeGreaterThan(1);
  });
  it('na linha, desce um pouco abaixo da linha', async () => {
    const r = await texToSvg('x_i^2', false);
    expect(r?.valignEx).toBeLessThan(0);
  });
  it('LaTeX com erro devolve null (o texto fica como está)', async () => {
    expect(await texToSvg('\\frac{1}{', false)).toBeNull();
    expect(await texToSvg('\\comandoquenaoexiste', false)).toBeNull();
  });
});
