import { describe, expect, test } from '@jest/globals';

import { parseQuery, valueFromText, type Condition, type Query } from '@/lib/query/parse';
import { queryToText, type QueryLang } from '@/lib/query/serialize';

import { semente } from './fixtures/notas-geradas';

const FIELDS = ['tag', 'due', 'priority', 'title', 'status', 'created', 'updated'] as const;

function randomQuery(r: () => number): Query {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const source = r() < 0.7 ? 'tasks' : 'notes';
  const conditions: Condition[] = Array.from({ length: Math.floor(r() * 3) }, () => {
    const kind = r() < 0.2 ? 'prop' : pick(FIELDS);
    const field = kind === 'prop' ? { kind: 'prop' as const, name: pick(['nota', 'autor', 'lido']) } : { kind };
    const value = pick([
      { kind: 'text' as const, value: pick(['casa', 'Mercado do bairro', 'leitura']) },
      { kind: 'number' as const, value: pick([0, 3, 4.5]) },
      { kind: 'day' as const, offset: pick([0, 7, -2]) },
      { kind: 'date' as const, value: '2026-12-01' },
      { kind: 'bool' as const, value: true },
    ]);
    return { field, op: pick(['=', '!=', '<', '<=', '>', '>=', 'contains'] as const), value };
  });
  return {
    source,
    lists: r() < 0.3 ? [pick(['Caixa de entrada', 'Mercado'])] : [],
    folders: r() < 0.3 ? [pick(['Casa', 'Exemplos das novidades'])] : [],
    conditions,
    done: source === 'tasks' ? pick([null, true, false]) : null,
    sort: r() < 0.5 ? { field: { kind: pick(FIELDS) }, desc: r() < 0.5 } : null,
    limit: r() < 0.3 ? pick([5, 10, 50]) : null,
    view: pick(['list', 'table', 'count'] as const),
  };
}

describe('consulta: estrutura → frase → estrutura (R2b)', () => {
  test.each(['pt', 'en', 'es'] as QueryLang[])('quinhentas consultas aleatórias em %s', (lang) => {
    const r = semente(lang.charCodeAt(0));
    for (let i = 0; i < 500; i++) {
      const q = randomQuery(r);
      const text = queryToText(q, lang);
      const back = parseQuery(text);
      expect(back).toEqual({ ok: true, query: q });
    }
  });

  test('a frase sai como alguém escreveria', () => {
    expect(
      queryToText({
        source: 'tasks',
        lists: [],
        folders: ['Exemplos das novidades'],
        conditions: [],
        done: false,
        sort: { field: { kind: 'due' }, desc: false },
        limit: null,
        view: 'table',
      }),
    ).toBe('tarefas da pasta "Exemplos das novidades" não concluídas ordenar por vence como tabela');
  });

  test('o valor digitado no campo vale como na frase', () => {
    expect(valueFromText({ kind: 'due' }, 'hoje+7')).toEqual({ kind: 'day', offset: 7 });
    expect(valueFromText({ kind: 'priority' }, 'alta')).toEqual({ kind: 'number', value: 3 });
    expect(valueFromText({ kind: 'title' }, 'casa nova')).toEqual({ kind: 'text', value: 'casa nova' });
    expect(valueFromText({ kind: 'tag' }, '')).toBeNull();
  });
});
