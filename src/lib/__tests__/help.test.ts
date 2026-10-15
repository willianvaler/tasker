import { describe, expect, test } from '@jest/globals';

import { HELP } from '../../content/help';

declare const require: (id: string) => unknown;

describe('artigos da Ajuda (content/help)', () => {
  test('os três idiomas têm os mesmos artigos', () => {
    const slugs = (lang: string) => (HELP[lang] ?? []).map((a) => a.slug);
    expect(slugs('en')).toEqual(slugs('pt-BR'));
    expect(slugs('es')).toEqual(slugs('pt-BR'));
    expect(slugs('pt-BR').length).toBeGreaterThanOrEqual(15);
  });

  test('o arquivo gerado está em dia (npm run help:build)', () => {
    // Sem @types/node no projeto: o Jest roda no Node, então o require existe
    const fs = require('fs') as {
      readFileSync: (p: string, e: string) => string;
      readdirSync: (p: string) => string[];
    };
    for (const lang of Object.keys(HELP)) {
      const files = fs
        .readdirSync(`content/help/${lang}`)
        .filter((f) => f.endsWith('.md'))
        .sort();
      files.forEach((file, i) => {
        const [first, ...rest] = fs
          .readFileSync(`content/help/${lang}/${file}`, 'utf8')
          .trim()
          .split('\n');
        expect(HELP[lang][i].title).toBe(first.replace(/^#\s*/, '').trim());
        expect(HELP[lang][i].body).toBe(rest.join('\n').trim());
      });
    }
  });
});
