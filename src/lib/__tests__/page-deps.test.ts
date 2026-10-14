import { describe, expect, test } from '@jest/globals';

import { blockedPages, pageBlockers, pageProgress, type PageDep } from '../page-deps';
import { taskState } from '../task-state';

// Os mesmos casos de supabase/tests/dependencia_paginas.test.sql
const t = (id: string, status = 'todo', parent: string | null = null) => ({
  id,
  parent_task_id: parent,
  status,
  completed_at: status === 'done' ? '2026-10-14T10:00:00Z' : null,
  started_at: null,
  deps_mode: 'all',
});
const dep = (page: string, on: string, threshold = 100): PageDep => ({
  id: `${on}>${page}`,
  page_id: page,
  depends_on_page_id: on,
  threshold_pct: threshold,
});

describe('dependência entre listas', () => {
  const alvenaria = (doneKids: number) => [
    t('paredes'),
    t('tijolos', doneKids > 0 ? 'done' : 'todo', 'paredes'),
    t('reboco', doneKids > 1 ? 'done' : 'todo', 'paredes'),
    t('eletrica'),
  ];

  test('progresso conta as folhas (a mãe é pacote)', () => {
    expect(pageProgress(alvenaria(0))).toEqual({ done: 0, total: 3 });
  });

  test('espera o percentual; 66% não basta para 100%, basta para 50%', () => {
    const progress = new Map([['alvenaria', pageProgress(alvenaria(2))]]);
    expect(pageBlockers('acabamento', [dep('acabamento', 'alvenaria')], progress)).toEqual([
      { pageId: 'alvenaria', pct: 66, threshold: 100 },
    ]);
    expect(pageBlockers('acabamento', [dep('acabamento', 'alvenaria', 50)], progress)).toEqual([]);
  });

  test('lista vazia não segura', () => {
    expect(pageBlockers('a', [dep('a', 'vazia')], new Map())).toEqual([]);
  });

  test('a tarefa da lista bloqueada fica bloqueada', () => {
    const progress = new Map([['alvenaria', pageProgress(alvenaria(0))]]);
    const blocked = blockedPages([dep('acabamento', 'alvenaria')], progress);
    const pintar = { ...t('pintar'), page_id: 'acabamento' };
    expect(taskState('pintar', new Map([['pintar', pintar]]), [], new Date(), blocked)).toEqual({
      state: 'blocked',
      waitingOn: [],
      pageBlocked: true,
    });
    expect(taskState('pintar', new Map([['pintar', pintar]]), [], new Date()).state).toBe('ready');
  });
});
