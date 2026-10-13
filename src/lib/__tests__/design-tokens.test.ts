import { describe, expect, test } from '@jest/globals';

import { COLORS, hexToRgbTriplet } from '../tokens';

// Guarda do docs/DESIGN.md: nada de valor solto em componente.
declare const require: (id: string) => unknown;
const fs = require('fs') as {
  readFileSync: (p: string, e: string) => string;
  readdirSync: (p: string, o: { recursive: true }) => string[];
};

const css = fs.readFileSync('src/global.css', 'utf8');
const sources = fs
  .readdirSync('src', { recursive: true })
  .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes('__tests__') && !f.endsWith('database.types.ts'))
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
      [...(block.exec(css)?.[1] ?? '').matchAll(/--([\w-]+):\s*([\d ]+);/g)].map((m) => [m[1], m[2]]),
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
