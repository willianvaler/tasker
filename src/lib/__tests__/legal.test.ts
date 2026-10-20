import { describe, expect, test } from '@jest/globals';

import { LEGAL_VERSION, legalDoc } from '@/content/legal';

describe('termos e privacidade (V5 §4, D213)', () => {
  test('a versão é a mesma de public.legal_version() da migração mais nova', () => {
    // Sem @types/node no projeto: o Jest roda no Node, então o require existe
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as {
      readFileSync: (p: string, e: string) => string;
      readdirSync: (p: string) => string[];
    };
    const dir = 'supabase/migrations';
    const latest = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => fs.readFileSync(`${dir}/${f}`, 'utf8'))
      .filter((sql) => sql.includes('function public.legal_version()'))
      .pop();
    expect(/select '([\d.-]+)'/.exec(latest ?? '')?.[1]).toBe(LEGAL_VERSION);
  });

  test('os três idiomas têm as mesmas seções', () => {
    for (const doc of ['terms', 'privacy'] as const) {
      const sizes = ['pt-BR', 'en', 'es'].map((l) => legalDoc(doc, l).sections.length);
      expect(new Set(sizes).size).toBe(1);
    }
  });

  test('idioma desconhecido cai no português', () => {
    expect(legalDoc('terms', 'fr').title).toBe('Termos de uso');
  });
});
