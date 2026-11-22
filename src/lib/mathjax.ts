// LaTeX → SVG pelo MathJax (ES2, D323): o mesmo desenho na web e no celular, sem WebView, sem fonte
// para baixar e sem internet (o SVG traz os traços das letras). A biblioteca é grande, então só é
// carregada na primeira fórmula (`import()`), e cada fórmula convertida fica guardada.

export type MathSvg = {
  /** O SVG, com a cor do texto no lugar de `currentColor` (troca quem desenha) */
  svg: string;
  /** Tamanho em `ex` (o MathJax mede assim) e o quanto desce abaixo da linha */
  widthEx: number;
  heightEx: number;
  valignEx: number;
};

type Converter = (tex: string, display: boolean) => string;

let converter: Promise<Converter> | null = null;

type Modules = {
  mathjax: {
    document: (doc: string, options: object) => { convert: (tex: string, o: object) => unknown };
  };
  TeX: new (options: object) => unknown;
  SVG: new (options: object) => unknown;
  liteAdaptor: () => { innerHTML: (node: never) => string };
  RegisterHTMLHandler: (adaptor: unknown) => void;
  AllPackages: string[];
};

/** Monta o conversor com os módulos do MathJax (o teste passa por `require`; o app, por `import()`) */
export function createConverter(m: Modules): Converter {
  const adaptor = m.liteAdaptor();
  m.RegisterHTMLHandler(adaptor);
  const doc = m.mathjax.document('', {
    InputJax: new m.TeX({ packages: m.AllPackages.filter((p) => p !== 'bussproofs') }),
    // Sem cache de fontes: cada SVG fica completo, sem depender de outro na página
    OutputJax: new m.SVG({ fontCache: 'none' }),
  });
  return (tex, display) => adaptor.innerHTML(doc.convert(tex, { display }) as never);
}

async function load(): Promise<Converter> {
  const [a, b, c, d, e, f] = await Promise.all([
    import('mathjax-full/js/mathjax.js'),
    import('mathjax-full/js/input/tex.js'),
    import('mathjax-full/js/output/svg.js'),
    import('mathjax-full/js/adaptors/liteAdaptor.js'),
    import('mathjax-full/js/handlers/html.js'),
    import('mathjax-full/js/input/tex/AllPackages.js'),
  ]);
  return createConverter({
    mathjax: a.mathjax,
    TeX: b.TeX,
    SVG: c.SVG,
    liteAdaptor: d.liteAdaptor,
    RegisterHTMLHandler: e.RegisterHTMLHandler,
    AllPackages: f.AllPackages,
  } as unknown as Modules);
}

/** Para o teste: o conversor já montado (o Jest não roda `import()` sem flag experimental) */
export function setConverter(value: Converter) {
  converter = Promise.resolve(value);
}

const cache = new Map<string, MathSvg | null>();

const num = (v: string | undefined) => (v ? Number.parseFloat(v) : 0);

/** O SVG da fórmula; null quando o LaTeX tem erro (quem desenha mostra o texto). */
export async function texToSvg(tex: string, display: boolean): Promise<MathSvg | null> {
  const key = `${display ? 'D' : 'I'}${tex}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  converter ??= load();
  let result: MathSvg | null = null;
  try {
    const svg = (await converter)(tex, display);
    // Erro de LaTeX: o MathJax desenha o erro (merror, ou o comando desconhecido em vermelho)
    if (/data-mml-node="merror"|fill="red"/.test(svg)) result = null;
    else {
      const width = /width="([\d.]+)ex"/.exec(svg)?.[1];
      const height = /height="([\d.]+)ex"/.exec(svg)?.[1];
      const valign = /vertical-align:\s*(-?[\d.]+)ex/.exec(svg)?.[1];
      result = {
        svg,
        widthEx: num(width),
        heightEx: num(height),
        valignEx: num(valign),
      };
    }
  } catch {
    result = null;
  }
  if (cache.size > 300) cache.clear();
  cache.set(key, result);
  return result;
}

/** Já convertida? (para desenhar na hora, sem piscar) */
export const cachedSvg = (tex: string, display: boolean) =>
  cache.get(`${display ? 'D' : 'I'}${tex}`);
