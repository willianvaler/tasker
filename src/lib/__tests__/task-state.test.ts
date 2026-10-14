import { describe, expect, test } from '@jest/globals';

import { taskState, type StateDep, type StateTask } from '../task-state';

// Os mesmos casos de supabase/tests/dependencias_estado.test.sql
const now = new Date('2026-10-14T12:00:00Z');
const t = (id: string, extra: Partial<StateTask> = {}): StateTask => ({
  id,
  parent_task_id: null,
  status: 'todo',
  completed_at: null,
  started_at: null,
  deps_mode: 'all',
  ...extra,
});
const done = (minutesAgo: number) => ({
  status: 'done',
  completed_at: new Date(now.getTime() - minutesAgo * 60_000).toISOString(),
});
const dep = (task: string, on: string, lag = 0): StateDep => ({
  task_id: task,
  depends_on_task_id: on,
  lag_minutes: lag,
});
const state = (id: string, tasks: StateTask[], deps: StateDep[]) =>
  taskState(id, new Map(tasks.map((x) => [x.id, x])), deps, now);

describe('estados derivados', () => {
  test('sem pré-requisito: pronta; iniciada: em andamento; concluída', () => {
    expect(state('a', [t('a')], []).state).toBe('ready');
    expect(state('a', [t('a', { started_at: now.toISOString() })], []).state).toBe('doing');
    expect(state('a', [t('a', done(5))], []).state).toBe('done');
  });

  test('carvão → fogo: bloqueada até o carvão, depois pronta', () => {
    const deps = [dep('fogo', 'carvao')];
    expect(state('fogo', [t('fogo'), t('carvao')], deps)).toEqual({
      state: 'blocked',
      waitingOn: ['carvao'],
    });
    expect(state('fogo', [t('fogo'), t('carvao', done(1))], deps).state).toBe('ready');
  });

  test('atraso: concluído há 10 min com 30 de espera ainda bloqueia, e diz quando libera', () => {
    const r = state('carne', [t('carne'), t('fogo', done(10))], [dep('carne', 'fogo', 30)]);
    expect(r.state).toBe('blocked');
    expect(r.readyAt).toBe('2026-10-14T12:20:00.000Z');
    expect(state('carne', [t('carne'), t('fogo', done(31))], [dep('carne', 'fogo', 30)]).state).toBe(
      'ready',
    );
  });

  test('modo todas × qualquer uma', () => {
    const deps = [dep('x', 'a'), dep('x', 'b')];
    expect(state('x', [t('x'), t('a', done(1)), t('b')], deps).state).toBe('blocked');
    expect(state('x', [t('x', { deps_mode: 'any' }), t('a', done(1)), t('b')], deps).state).toBe(
      'ready',
    );
    expect(state('x', [t('x', { deps_mode: 'any' }), t('a'), t('b')], deps).waitingOn).toEqual([
      'a',
      'b',
    ]);
  });

  test('a filha herda o bloqueio da mãe', () => {
    const tasks = [t('mae'), t('filha', { parent_task_id: 'mae' }), t('pre')];
    expect(state('filha', tasks, [dep('mae', 'pre')]).state).toBe('blocked');
    expect(state('filha', tasks, [dep('mae', 'pre')]).waitingOn).toEqual(['pre']);
  });

  test('pré-requisito reaberto volta a bloquear; iniciada e bloqueada continua bloqueada', () => {
    const tasks = [t('fogo', { started_at: now.toISOString() }), t('carvao')];
    expect(state('fogo', tasks, [dep('fogo', 'carvao')]).state).toBe('blocked');
  });

  test('pré-requisito que sumiu (apagado) não segura', () => {
    expect(state('fogo', [t('fogo')], [dep('fogo', 'carvao')]).state).toBe('ready');
  });
});
