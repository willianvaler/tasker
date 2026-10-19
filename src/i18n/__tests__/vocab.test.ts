import { describe, expect, test } from '@jest/globals';

import en from '../locales/en.json';
import es from '../locales/es.json';
import ptBR from '../locales/pt-BR.json';
import vocabEn from '../vocab/en.json';
import vocabEs from '../vocab/es.json';
import vocabPtBR from '../vocab/pt-BR.json';

const get = (o: unknown, key: string) =>
  key.split('.').reduce<unknown>((n, p) => (n as Record<string, unknown> | undefined)?.[p], o);

// Vocabulário de jogo (HB11): as mesmas chaves nos três idiomas, e todas existem nos textos base
describe('vocabulário de jogo', () => {
  test.each([
    ['pt-BR', ptBR, vocabPtBR],
    ['en', en, vocabEn],
    ['es', es, vocabEs],
  ] as const)('%s', (_, base, vocab) => {
    expect(Object.keys(vocab).sort()).toEqual(Object.keys(vocabPtBR).sort());
    for (const key of Object.keys(vocab)) expect(typeof get(base, key)).toBe('string');
  });
});
