import { describe, expect, it } from '@jest/globals';

import { isSelective, parseQuery, tokenize, type Query } from '../parse';
import {
  fetchPlan,
  propColumns,
  runNotes,
  runTasks,
  unknownNames,
  type QueryNote,
  type QueryTask,
} from '../run';

const ok = (text: string): Query => {
  const r = parseQuery(text);
  if (!r.ok) throw new Error(`${text}: ${JSON.stringify(r.error)}`);
  return r.query;
};
const ctx = { today: '2026-11-03', dayOf: (iso: string) => iso.slice(0, 10) };

describe('consulta: parser (OB7)', () => {
  it('os exemplos do escopo, em português', () => {
    expect(ok('tarefas onde etiqueta = casa e vence <= hoje+7 ordenar por vencimento')).toEqual({
      source: 'tasks',
      lists: [],
      folders: [],
      conditions: [
        { field: { kind: 'tag' }, op: '=', value: { kind: 'text', value: 'casa' } },
        { field: { kind: 'due' }, op: '<=', value: { kind: 'day', offset: 7 } },
      ],
      done: null,
      sort: { field: { kind: 'due' }, desc: false },
      limit: null,
      view: 'list',
    });
    const notes = ok('anotações onde etiqueta = leitura e props.nota >= 4');
    expect(notes.source).toBe('notes');
    expect(notes.conditions[1]).toEqual({
      field: { kind: 'prop', name: 'nota' },
      op: '>=',
      value: { kind: 'number', value: 4 },
    });
    const list = ok('tarefas da lista "Mercado" não concluídas');
    expect(list.lists).toEqual(['Mercado']);
    expect(list.done).toBe(false);
  });

  it('em inglês e em espanhol', () => {
    const en = ok(
      'tasks in list "Groceries" where priority >= high and title contains milk sort by due desc limit 5 as table',
    );
    expect(en.lists).toEqual(['Groceries']);
    expect(en.conditions).toEqual([
      { field: { kind: 'priority' }, op: '>=', value: { kind: 'number', value: 3 } },
      { field: { kind: 'title' }, op: 'contains', value: { kind: 'text', value: 'milk' } },
    ]);
    expect(en.sort).toEqual({ field: { kind: 'due' }, desc: true });
    expect(en.limit).toBe(5);
    expect(en.view).toBe('table');
    const es = ok(
      'tareas de la carpeta "Casa" donde vencimiento < mañana y etiqueta != urgente no completadas como conteo',
    );
    expect(es.folders).toEqual(['Casa']);
    expect(es.conditions[0]).toEqual({
      field: { kind: 'due' },
      op: '<',
      value: { kind: 'day', offset: 1 },
    });
    expect(es.conditions[1].op).toBe('!=');
    expect(es.done).toBe(false);
    expect(es.view).toBe('count');
    expect(ok('notas donde etiqueta = libros').source).toBe('notes');
  });

  it('datas, espaços e palavras misturadas', () => {
    expect(ok('tarefas onde vence >= hoje - 3').conditions[0].value).toEqual({
      kind: 'day',
      offset: -3,
    });
    expect(ok('tarefas onde vence = ontem').conditions[0].value).toEqual({
      kind: 'day',
      offset: -1,
    });
    expect(ok('tarefas onde vence<=2026-12-01').conditions[0].value).toEqual({
      kind: 'date',
      value: '2026-12-01',
    });
    expect(ok('tarefas onde status = andamento').conditions[0].value).toEqual({
      kind: 'text',
      value: 'doing',
    });
    expect(ok('TAREFAS ONDE Etiqueta = Casa').conditions[0].value).toEqual({
      kind: 'text',
      value: 'Casa',
    });
    // Condição sem o "onde"
    expect(ok('tarefas etiqueta = casa abertas').done).toBe(false);
    expect(tokenize('a<>b "x y"')).toEqual([
      { text: 'a', quoted: false, op: false },
      { text: '!=', quoted: false, op: true },
      { text: 'b', quoted: false, op: false },
      { text: 'x y', quoted: true, op: false },
    ]);
  });

  it('erros com a palavra que atrapalhou', () => {
    expect(parseQuery('')).toEqual({ ok: false, error: { code: 'empty' } });
    expect(parseQuery('coisas onde x = 1')).toEqual({
      ok: false,
      error: { code: 'source', word: 'coisas' },
    });
    expect(parseQuery('tarefas onde cor = azul')).toEqual({
      ok: false,
      error: { code: 'field', word: 'cor' },
    });
    expect(parseQuery('tarefas onde etiqueta casa')).toEqual({
      ok: false,
      error: { code: 'operator', word: 'casa' },
    });
    expect(parseQuery('tarefas limite zero')).toEqual({
      ok: false,
      error: { code: 'limit', word: 'zero' },
    });
    expect(parseQuery('tarefas banana')).toEqual({
      ok: false,
      error: { code: 'unexpected', word: 'banana' },
    });
    expect(parseQuery('anotações concluídas')).toEqual({ ok: false, error: { code: 'notesDone' } });
  });

  it('filtro seletivo (D70)', () => {
    expect(isSelective(ok('tarefas não concluídas'))).toBe(false);
    expect(isSelective(ok('tarefas onde prioridade = 3'))).toBe(false);
    expect(isSelective(ok('tarefas onde etiqueta != casa'))).toBe(false);
    expect(isSelective(ok('tarefas onde etiqueta = casa'))).toBe(true);
    expect(isSelective(ok('tarefas onde vence <= hoje'))).toBe(true);
    expect(isSelective(ok('tarefas da lista X'))).toBe(true);
    expect(isSelective(ok('anotações onde props.nota >= 4'))).toBe(true);
    expect(isSelective(ok('anotações ordenar por título'))).toBe(false);
  });
});

const task = (over: Partial<QueryTask>): QueryTask => ({
  id: over.title ?? 'x',
  title: 'x',
  status: 'todo',
  priority: 0,
  due_date: null,
  labels: [],
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
  completed_at: null,
  page_id: 'p1',
  folder_id: 'f1',
  parent_task_id: null,
  ...over,
});

describe('consulta: executor (OB7)', () => {
  const tasks = [
    task({ title: 'Lavar', labels: ['casa'], due_date: '2026-11-05', priority: 1 }),
    task({ title: 'Pintar', labels: ['casa'], due_date: '2026-11-20', priority: 3 }),
    task({ title: 'Varrer', labels: ['Casa'], due_date: '2026-11-04', status: 'done' }),
    task({ title: 'Ler', labels: ['livro'], due_date: null, page_id: 'p2' }),
  ];

  it('filtra, ordena e corta', () => {
    const q = ok('tarefas onde etiqueta = casa e vence <= hoje+7 ordenar por vencimento');
    expect(runTasks(tasks, q, ctx).rows.map((t) => t.title)).toEqual(['Varrer', 'Lavar']);
    const open = ok('tarefas onde etiqueta = casa não concluídas ordenar por prioridade desc');
    expect(runTasks(tasks, open, ctx).rows.map((t) => t.title)).toEqual(['Pintar', 'Lavar']);
    const limited = runTasks(tasks, ok('tarefas onde etiqueta = casa limite 1'), ctx);
    expect(limited).toMatchObject({ total: 3 });
    expect(limited.rows).toHaveLength(1);
    // Sem ordem: vencimento (sem data no fim) e prioridade
    expect(runTasks(tasks, ok('tarefas'), ctx).rows.map((t) => t.title)).toEqual([
      'Varrer',
      'Lavar',
      'Pintar',
      'Ler',
    ]);
    expect(
      runTasks(tasks, ok('tarefas da lista L'), ctx, { pageIds: ['p2'] }).rows.map((t) => t.title),
    ).toEqual(['Ler']);
    expect(runTasks(tasks, ok('tarefas onde título contém var'), ctx).rows[0].title).toBe('Varrer');
  });

  it('decide o que ler', () => {
    const pages = [{ id: 'p1', name: 'Mercado' }];
    const folders = [
      { id: 'f1', name: 'Casa', parent_id: null },
      { id: 'f2', name: 'Cozinha', parent_id: 'f1' },
    ];
    expect(fetchPlan(ok('tarefas da lista "mercado"'), ctx, pages, folders)).toEqual({
      by: 'pages',
      ids: ['p1'],
    });
    expect(fetchPlan(ok('tarefas da pasta Casa'), ctx, pages, folders)).toEqual({
      by: 'folders',
      ids: ['f1', 'f2'],
    });
    expect(fetchPlan(ok('tarefas onde etiqueta = casa'), ctx, pages, folders)).toEqual({
      by: 'tag',
      tag: 'casa',
    });
    expect(
      fetchPlan(ok('tarefas onde vence > hoje e vence < hoje+7'), ctx, pages, folders),
    ).toEqual({ by: 'due', from: '2026-11-04', to: '2026-11-09' });
    expect(fetchPlan(ok('tarefas'), ctx, pages, folders)).toEqual({ by: 'none' });
    expect(unknownNames(ok('tarefas da lista Feira'), pages, folders)).toEqual(['Feira']);
  });

  it('anotações: etiqueta aninhada e propriedades', () => {
    const note = (title: string, tags: string[], props: Record<string, unknown>): QueryNote => ({
      id: title,
      title,
      body: '',
      tags,
      props,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: `2026-10-0${title.length % 9}T00:00:00Z`,
      folder_id: null,
    });
    const notes = [
      note('Duna', ['leitura/ficcao'], { nota: 5, autor: 'Herbert', lido: true }),
      note('Sapiens', ['leitura'], { nota: '3' }),
      note('Bolo', ['receita'], { Nota: 4, autores: ['Ana', 'Bia'] }),
    ];
    const q = ok('anotações onde etiqueta = leitura e props.nota >= 4');
    expect(runNotes(notes, q, ctx).rows.map((n) => n.title)).toEqual(['Duna']);
    expect(
      runNotes(notes, ok('notas donde props.nota >= 3 ordenar por props.nota desc'), ctx).rows.map(
        (n) => n.title,
      ),
    ).toEqual(['Duna', 'Bolo', 'Sapiens']);
    expect(runNotes(notes, ok('notes where props.autores = bia'), ctx).rows[0].title).toBe('Bolo');
    expect(runNotes(notes, ok('anotações onde props.lido = sim'), ctx).rows[0].title).toBe('Duna');
    expect(propColumns(ok('anotações onde props.nota >= 4 ordenar por props.autor'))).toEqual([
      'nota',
      'autor',
    ]);
  });
});
