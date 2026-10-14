import { describe, expect, it } from '@jest/globals';

import en from '../locales/en.json';
import es from '../locales/es.json';
import ptBR from '../locales/pt-BR.json';

// Uma chave que existe num idioma e falta em outro derruba o teste.
type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [k, v] of leaves(value, path)) out.set(k, v);
  }
  return out;
}

/** Variáveis de interpolação ({{nome}}) de um texto, em ordem alfabética. */
function variables(text: string) {
  return [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();
}

const reference = leaves(ptBR);
const others = { en: leaves(en), es: leaves(es) };

describe.each(Object.entries(others))('%s', (_, locale) => {
  it('tem exatamente as chaves do pt-BR', () => {
    expect([...locale.keys()].sort()).toEqual([...reference.keys()].sort());
  });

  it('nenhum texto vazio', () => {
    expect([...locale].filter(([, text]) => !text.trim()).map(([key]) => key)).toEqual([]);
  });

  it('as mesmas variáveis de interpolação', () => {
    const different = [...reference]
      .filter(([key]) => locale.has(key))
      .filter(([key, text]) => variables(text).join() !== variables(locale.get(key)!).join())
      .map(([key]) => key);
    expect(different).toEqual([]);
  });
});

it('pt-BR sem textos vazios', () => {
  expect([...reference].filter(([, text]) => !text.trim()).map(([key]) => key)).toEqual([]);
});
