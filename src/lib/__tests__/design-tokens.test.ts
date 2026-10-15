import { describe, expect, test } from '@jest/globals';

import { COLORS, hexToRgbTriplet } from '../tokens';

// Nada de valor solto em componente.
declare const require: (id: string) => unknown;
const fs = require('fs') as {
  readFileSync: (p: string, e: string) => string;
  readdirSync: (p: string, o: { recursive: true }) => string[];
};

const css = fs.readFileSync('src/global.css', 'utf8');
const sources = fs
  .readdirSync('src', { recursive: true })
  .filter(
    (f) => /\.(ts|tsx)$/.test(f) && !f.includes('__tests__') && !f.endsWith('database.types.ts'),
  )
  .map((f) => ({ file: f, text: fs.readFileSync(`src/${f}`, 'utf8') }));

/** Arquivos (e o trecho) em que a expressão aparece. */
function offenders(pattern: RegExp, allow: string[] = []) {
  return sources
    .filter(({ file }) => !allow.includes(file))
    .flatMap(({ file, text }) => [...text.matchAll(pattern)].map((m) => `${file}: ${m[0]}`));
}

describe('cores', () => {
  test.each(['light', 'dark'] as const)('global.css (%s) = tokens.ts', (theme) => {
    const block = theme === 'light' ? /:root\s*{([^}]*)}/ : /\.dark:root\s*{([^}]*)}/;
    const vars = Object.fromEntries(
      [...(block.exec(css)?.[1] ?? '').matchAll(/--([\w-]+):\s*([\d ]+);/g)].map((m) => [
        m[1],
        m[2],
      ]),
    );
    const expected = Object.fromEntries(
      Object.entries(COLORS[theme]).map(([k, hex]) => [k, hexToRgbTriplet(hex)]),
    );
    expect(vars).toEqual(expected);
  });

  test('nenhuma cor hexadecimal fora de lib/tokens.ts', () => {
    expect(offenders(/['"`]#[0-9a-fA-F]{3,8}\b/g, ['lib/tokens.ts'])).toEqual([]);
  });

  test('nenhuma cor da paleta padrão do Tailwind', () => {
    const palette =
      /\b(?:bg|text|border|ring|fill|stroke|decoration|divide)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+)\b/g;
    expect(offenders(palette)).toEqual([]);
  });
});

describe('escalas', () => {
  const prefix = String.raw`(?<![\w-])(?:[a-z]+:)*`;
  test.each([
    ['tamanho de fonte fora dos 5', String.raw`text-(?:[2-9]xl|\[\d+px\])`],
    ['peso fora de 400/600', String.raw`font-(?:thin|light|medium|bold|extrabold|black)`],
    ['raio fora de 4/8 px', String.raw`rounded(?:-[trblse]{1,2})?-(?:sm|md|xl|2xl|3xl)`],
    ['sombra', String.raw`shadow(?:-(?:sm|md|lg|xl|2xl))?(?![\w-])`],
    [
      'espaço fora de 4·8·12·16·24·32·48',
      String.raw`-?(?:p[xytblrse]?|m[xytblrse]?|gap(?:-[xy])?|space-[xy])-(?:0\.5|1\.5|2\.5|3\.5|5|7|9|10|11|14|16|20|24|28|32|36|40)(?![\w.-])`,
    ],
  ])('%s', (_, pattern) => {
    expect(offenders(new RegExp(prefix + pattern + String.raw`(?![\w-])`, 'g'))).toEqual([]);
  });

  test('Text vem de components/ui/text (família por peso), nunca direto do react-native', () => {
    expect(
      offenders(/import \{[^}]*\bText\b[^}]*\} from 'react-native'/g, ['components/ui/text.tsx']),
    ).toEqual([]);
  });
});

describe('contraste AA (F4)', () => {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  test.each(['light', 'dark'] as const)('texto %s tem pelo menos 4,5:1 nos fundos', (scheme) => {
    const c = COLORS[scheme];
    for (const fg of ['ink', 'ink-muted', 'accent', 'ok', 'warn', 'danger'] as const)
      for (const bg of ['paper', 'surface', 'wash'] as const)
        expect([fg, bg, ratio(c[fg], c[bg]) >= 4.5]).toEqual([fg, bg, true]);
    expect(ratio(c['on-accent'], c.accent)).toBeGreaterThanOrEqual(4.5);
  });
});
