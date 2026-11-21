import { describe, expect, it } from '@jest/globals';

import {
  allViews,
  applyView,
  groupKeys,
  groupTasks,
  fixedKeys,
  matchesFilter,
  moveTo,
  newView,
  pageViews,
  personalViews,
  readViews,
  removeView,
  sortTasks,
  upsertView,
  writePageViews,
  writePersonalViews,
  DEFAULT_FILTER,
  type ViewContext,
  type ViewTask,
} from '../list-views';

const task = (id: string, over: Partial<ViewTask> = {}): ViewTask => ({
  id,
  title: id,
  status: 'todo',
  priority: 0,
  due_date: null,
  labels: [],
  position: 0,
  created_at: '2026-11-01T00:00:00Z',
  custom: {},
  parent_task_id: null,
  ...over,
});

const ctx: ViewContext = {
  today: '2026-11-21',
  me: 'eu',
  assigneesOf: (id) => (id === 'a' ? ['eu', 'ana'] : id === 'b' ? ['ana'] : []),
};

describe('ler e gravar', () => {
  it('readViews fica com o que é válido, sem repetir id', () => {
    const views = readViews([
      { id: 'v1', name: ' Quadro ', kind: 'board', group: 'none' },
      { id: 'v1', name: 'repetida', kind: 'list' },
      { id: 'v2', name: 'x', kind: 'mapa' },
      null,
      {
        id: 'v3',
        name: 'Tabela',
        kind: 'table',
        sort: 'due',
        desc: true,
        columns: ['title', 'field:abc', 'senha', 'title'],
        filter: { status: 'open', due: 'overdue', label: ' casa ', mine: true },
      },
    ]);
    expect(views.map((v) => v.id)).toEqual(['v1', 'v3']);
    // Quadro sem grupo vira por estado
    expect(views[0]).toMatchObject({ name: 'Quadro', group: 'status', sort: 'position' });
    expect(views[1].columns).toEqual(['title', 'field:abc']);
    expect(views[1].filter).toEqual({ status: 'open', due: 'overdue', label: 'casa', mine: true });
    expect(readViews('x')).toEqual([]);
  });
  it('as do projeto ficam em config.views, sem mexer no resto', () => {
    const v = newView('v1', 'Tabela', 'table');
    const config = writePageViews({ meeting: 1 }, [v]);
    expect(config).toEqual({ meeting: 1, views: [v] });
    expect(pageViews(config)).toEqual([v]);
    expect(writePageViews(config, [])).toEqual({ meeting: 1 });
  });
  it('as pessoais ficam por lista em ui_prefs.list_views', () => {
    const v = newView('v1', 'Minha', 'calendar');
    const prefs = writePersonalViews({ outra: [] }, 'p1', [v]);
    expect(personalViews(prefs, 'p1')).toEqual([v]);
    expect(personalViews(prefs, 'p2')).toEqual([]);
    expect(writePersonalViews(prefs, 'p1', [])).toEqual({ outra: [] });
  });
  it('allViews: as do projeto primeiro; upsert e remove mantêm a ordem', () => {
    const a = newView('a', 'A', 'list');
    const b = newView('b', 'B', 'board');
    expect(allViews([a], [b, a]).map((v) => `${v.id}:${v.scope}`)).toEqual([
      'a:project',
      'b:personal',
    ]);
    const renamed = { ...a, name: 'A2' };
    expect(upsertView([a, b], renamed).map((v) => v.name)).toEqual(['A2', 'B']);
    expect(upsertView([a], b).map((v) => v.id)).toEqual(['a', 'b']);
    expect(removeView([a, b], 'a')).toEqual([b]);
  });
});

describe('filtro e ordem', () => {
  it('estado, prazo, etiqueta e só as minhas', () => {
    const late = task('a', { due_date: '2026-11-20', labels: ['casa'] });
    const soon = task('b', { due_date: '2026-11-25' });
    const done = task('c', { status: 'done', due_date: '2026-11-01' });
    const f = (over: Partial<typeof DEFAULT_FILTER>) => ({ ...DEFAULT_FILTER, ...over });
    expect(matchesFilter(done, f({ status: 'open' }), ctx)).toBe(false);
    expect(matchesFilter(done, f({ status: 'done' }), ctx)).toBe(true);
    expect(matchesFilter(late, f({ due: 'overdue' }), ctx)).toBe(true);
    // Concluída não é atrasada
    expect(matchesFilter(done, f({ due: 'overdue' }), ctx)).toBe(false);
    expect(matchesFilter(soon, f({ due: 'week' }), ctx)).toBe(true);
    expect(matchesFilter(late, f({ due: 'week' }), ctx)).toBe(false);
    expect(matchesFilter(task('d'), f({ due: 'undated' }), ctx)).toBe(true);
    expect(matchesFilter(late, f({ label: 'casa' }), ctx)).toBe(true);
    expect(matchesFilter(soon, f({ label: 'casa' }), ctx)).toBe(false);
    expect(matchesFilter(late, f({ mine: true }), ctx)).toBe(true);
    expect(matchesFilter(soon, f({ mine: true }), ctx)).toBe(false);
  });
  it('sortTasks: sem data no fim, prioridade mais alta primeiro, empate pela ordem da lista', () => {
    const list = [
      task('x', { position: 2, due_date: null, priority: 1 }),
      task('y', { position: 1, due_date: '2026-12-01', priority: 3 }),
      task('z', { position: 3, due_date: '2026-11-22', priority: 1 }),
    ];
    expect(sortTasks(list, 'due', false).map((t) => t.id)).toEqual(['z', 'y', 'x']);
    expect(sortTasks(list, 'due', true).map((t) => t.id)).toEqual(['y', 'z', 'x']);
    expect(sortTasks(list, 'priority', false).map((t) => t.id)).toEqual(['y', 'x', 'z']);
    expect(sortTasks(list, 'position', false).map((t) => t.id)).toEqual(['y', 'x', 'z']);
  });
  it('applyView: lista sem as subtarefas; calendário com elas', () => {
    const list = [task('a'), task('s', { parent_task_id: 'a' })];
    expect(applyView(list, newView('v', 'L', 'list'), ctx).map((t) => t.id)).toEqual(['a']);
    expect(applyView(list, newView('v', 'C', 'calendar'), ctx).map((t) => t.id)).toEqual([
      'a',
      's',
    ]);
  });
});

describe('grupos e quadro', () => {
  it('groupKeys por cada tipo de grupo', () => {
    const t = task('a', { priority: 2, labels: ['casa', 'rua'], custom: { fase: 'Compra' } });
    expect(groupKeys(t, 'priority', ctx)).toEqual(['2']);
    expect(groupKeys(t, 'label', ctx)).toEqual(['casa', 'rua']);
    expect(groupKeys(t, 'assignee', ctx)).toEqual(['eu', 'ana']);
    expect(groupKeys(t, 'field:fase', ctx)).toEqual(['Compra']);
    expect(groupKeys(task('z'), 'field:fase', ctx)).toEqual(['']);
    expect(groupKeys(task('z'), 'assignee', ctx)).toEqual(['']);
  });
  it('groupTasks: colunas fixas na ordem, o resto antes do "sem valor"', () => {
    const list = [
      task('a', { custom: { fase: 'Obra' } }),
      task('b', { custom: { fase: 'Antiga' } }),
      task('c'),
    ];
    const fixed = fixedKeys('field:fase', { fieldOptions: ['Compra', 'Obra'] });
    const groups = groupTasks(list, 'field:fase', ctx, fixed, true);
    expect(groups.map((g) => `${g.key}:${g.tasks.length}`)).toEqual([
      'Compra:0',
      'Obra:1',
      'Antiga:1',
      ':1',
    ]);
    // Sem keepEmpty, só os que têm tarefa
    expect(groupTasks(list, 'field:fase', ctx, fixed, false).map((g) => g.key)).toEqual([
      'Obra',
      'Antiga',
      '',
    ]);
    expect(fixedKeys('priority')).toEqual(['3', '2', '1', '0']);
  });
  it('moveTo diz o que muda na tarefa', () => {
    const t = task('a', { labels: ['casa', 'rua'], custom: { fase: 'Compra', x: 1 } });
    expect(moveTo(t, 'status', 'todo', 'done')).toEqual({ type: 'status', status: 'done' });
    expect(moveTo(t, 'priority', '0', '3')).toEqual({ type: 'patch', patch: { priority: 3 } });
    expect(moveTo(t, 'label', 'casa', 'loja')).toEqual({
      type: 'patch',
      patch: { labels: ['rua', 'loja'] },
    });
    expect(moveTo(t, 'label', 'casa', '')).toEqual({ type: 'patch', patch: { labels: ['rua'] } });
    expect(moveTo(t, 'field:fase', 'Compra', 'Obra')).toEqual({
      type: 'patch',
      patch: { custom: { fase: 'Obra', x: 1 } },
    });
    expect(moveTo(t, 'field:fase', 'Compra', '')).toEqual({
      type: 'patch',
      patch: { custom: { x: 1 } },
    });
    expect(moveTo(t, 'assignee', 'ana', '')).toEqual({
      type: 'assignee',
      remove: 'ana',
      add: null,
    });
    expect(moveTo(t, 'priority', '1', '1')).toBeNull();
  });
});
