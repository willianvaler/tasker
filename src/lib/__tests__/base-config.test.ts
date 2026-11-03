import { describe, expect, it } from '@jest/globals';

import {
  baseColumns,
  cellInput,
  groupRows,
  nextSort,
  notePropNames,
  parseCell,
  propValue,
  readBaseConfig,
  sortRows,
  toggleColumn,
} from '../base-config';

describe('bases: configuração (OB8)', () => {
  it('lê o JSON com os padrões', () => {
    expect(readBaseConfig(null)).toEqual({
      query: '',
      view: 'table',
      columns: [],
      group: null,
      sort: null,
    });
    expect(
      readBaseConfig({
        query: 'tarefas onde etiqueta = casa',
        view: 'cards',
        columns: ['due', 'due', 3, ''],
        group: 'status',
        sort: { column: 'due', desc: true },
      }),
    ).toEqual({
      query: 'tarefas onde etiqueta = casa',
      view: 'cards',
      columns: ['due'],
      group: 'status',
      sort: { column: 'due', desc: true },
    });
    expect(readBaseConfig({ view: 'kanban', sort: { column: '' } })).toMatchObject({
      view: 'table',
      sort: null,
    });
  });

  it('colunas: padrão, título na frente e propriedades só nas anotações', () => {
    const empty = readBaseConfig({});
    expect(baseColumns(empty, 'tasks')).toEqual(['title', 'list', 'due', 'priority', 'tags']);
    expect(baseColumns(empty, 'notes')).toEqual(['title', 'tags', 'updated']);
    const c = readBaseConfig({ columns: ['priority', 'title', 'props.nota', 'banana'] });
    expect(baseColumns(c, 'tasks')).toEqual(['title', 'priority']);
    expect(baseColumns(c, 'notes')).toEqual(['title', 'props.nota']);
    const off = toggleColumn(empty, 'tasks', 'list');
    expect(baseColumns(off, 'tasks')).toEqual(['title', 'due', 'priority', 'tags']);
    expect(baseColumns(toggleColumn(off, 'tasks', 'status'), 'tasks')).toEqual([
      'title',
      'due',
      'priority',
      'tags',
      'status',
    ]);
    expect(toggleColumn(off, 'tasks', 'title')).toBe(off);
  });

  it('ordem do cabeçalho: crescente, decrescente, nenhuma', () => {
    expect(nextSort(null, 'due')).toEqual({ column: 'due', desc: false });
    expect(nextSort({ column: 'due', desc: false }, 'due')).toEqual({ column: 'due', desc: true });
    expect(nextSort({ column: 'due', desc: true }, 'due')).toBeNull();
    expect(nextSort({ column: 'due', desc: true }, 'title')).toEqual({
      column: 'title',
      desc: false,
    });
  });

  it('ordena com vazio no fim e números como números', () => {
    const rows = [{ v: '10' }, { v: null }, { v: '9' }, { v: 'Ábaco' }, { v: 'zebra' }];
    expect(sortRows(rows, (r) => r.v, false).map((r) => r.v)).toEqual([
      '9',
      '10',
      'Ábaco',
      'zebra',
      null,
    ]);
    expect(sortRows(rows, (r) => r.v, true).map((r) => r.v)).toEqual([
      'zebra',
      'Ábaco',
      '10',
      '9',
      null,
    ]);
  });

  it('agrupa, com a linha em cada etiqueta e o sem valor no fim', () => {
    const rows = [
      { t: 'a', tags: ['casa', 'urgente'] },
      { t: 'b', tags: [] },
      { t: 'c', tags: ['casa'] },
    ];
    expect(
      groupRows(rows, (r) => r.tags).map((g) => [g.key, g.rows.map((r) => r.t).join('')]),
    ).toEqual([
      ['casa', 'ac'],
      ['urgente', 'a'],
      ['', 'b'],
    ]);
    const prio = [{ p: 1 }, { p: 3 }, { p: 0 }];
    expect(
      groupRows(
        prio,
        (r) => String(r.p),
        (k) => -Number(k),
      ).map((g) => g.key),
    ).toEqual(['3', '1', '0']);
  });

  it('propriedades das anotações', () => {
    expect(
      notePropNames([
        { props: { nota: 4, Autor: 'x' } },
        { props: { autor: 'y', aliases: [] } },
        { props: null },
      ]),
    ).toEqual(['Autor', 'nota']);
    expect(propValue({ Nota: 4 }, 'nota')).toBe(4);
    expect(propValue(null, 'nota')).toBeUndefined();
  });

  it('edição na célula', () => {
    expect(parseCell('title', '  Lavar  ')).toEqual({ ok: true, value: 'Lavar' });
    expect(parseCell('title', ' ')).toEqual({ ok: false });
    expect(parseCell('priority', '!!')).toEqual({ ok: true, value: 2 });
    expect(parseCell('priority', '')).toEqual({ ok: true, value: 0 });
    expect(parseCell('priority', '5')).toEqual({ ok: false });
    expect(parseCell('due', '2026-11-10')).toEqual({ ok: true, value: '2026-11-10' });
    expect(parseCell('due', '2026-02-30')).toEqual({ ok: false });
    expect(parseCell('due', '')).toEqual({ ok: true, value: null });
    expect(parseCell('tags', '#casa, obra casa')).toEqual({ ok: true, value: ['casa', 'obra'] });
    expect(parseCell('props.nota', '4,5', 3)).toEqual({ ok: true, value: 4.5 });
    expect(parseCell('props.nota', 'muito', 3)).toEqual({ ok: false });
    expect(parseCell('props.lido', 'Sim', false)).toEqual({ ok: true, value: true });
    expect(parseCell('props.lido', 'no', true)).toEqual({ ok: true, value: false });
    expect(parseCell('props.autores', 'Ana, Bia', ['x'])).toEqual({
      ok: true,
      value: ['Ana', 'Bia'],
    });
    expect(parseCell('props.autor', 'Herbert')).toEqual({ ok: true, value: 'Herbert' });
    expect(parseCell('status', 'feito')).toEqual({ ok: false });
    expect(cellInput('tags', ['casa', 'obra'])).toBe('casa obra');
    expect(cellInput('priority', 0)).toBe('');
    expect(cellInput('props.autores', ['Ana', 'Bia'])).toBe('Ana, Bia');
  });
});
