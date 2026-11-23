import { describe, expect, it } from '@jest/globals';

import {
  neighbors,
  nextScale,
  nextSession,
  stepIndex,
  studySequence,
  type StudyTask,
} from '../study';

const t = (
  id: string,
  page: string,
  parent: string | null,
  position: number,
  status = 'todo',
): StudyTask => ({
  id,
  title: id,
  page_id: page,
  parent_task_id: parent,
  status,
  position,
});

describe('o que estudar agora (ES7)', () => {
  const pages = [{ id: 'fase0' }, { id: 'fase1a' }];
  it('a primeira sessão aberta, na ordem das listas e da árvore', () => {
    const tasks = [
      t('leia', 'fase0', null, 1, 'done'),
      t('m02', 'fase1a', null, 2),
      t('m01', 'fase1a', null, 1),
      t('m01-s2', 'fase1a', 'm01', 2),
      t('m01-s1', 'fase1a', 'm01', 1, 'done'),
    ];
    const next = nextSession(pages, tasks);
    expect(next?.task.id).toBe('m01-s2');
    expect(next?.parent?.id).toBe('m01');
  });
  it('mãe sem sessão aberta conta como sessão; tudo feito: nada', () => {
    expect(nextSession(pages, [t('m01', 'fase1a', null, 1)])?.task.id).toBe('m01');
    expect(nextSession(pages, [t('m01', 'fase1a', null, 1, 'done')])).toBeNull();
  });
  it('anterior e próximo', () => {
    const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(neighbors(list, 'b')).toEqual({ prev: { id: 'a' }, next: { id: 'c' }, index: 1 });
    expect(neighbors(list, 'a').prev).toBeNull();
    expect(neighbors(list, 'x')).toEqual({ prev: null, next: null, index: -1 });
  });
  it('tamanho do texto, nos limites', () => {
    expect(nextScale(1, 1)).toBe(1.125);
    expect(nextScale(1.5, 1)).toBe(1.5);
    expect(nextScale(0.875, -1)).toBe(0.875);
  });
});

describe('ordem de leitura em capítulos (CD46)', () => {
  const task = (id: string, page: string, parent: string | null, position: number): StudyTask => ({
    id,
    title: id,
    page_id: page,
    parent_task_id: parent,
    status: 'open',
    position,
  });
  const tasks = [
    task('b', 'p1', null, 2),
    task('a', 'p1', null, 1),
    task('a2', 'p1', 'a', 2),
    task('a1', 'p1', 'a', 1),
    task('c', 'p2', null, 1),
  ];
  const link = (
    material_id: string,
    target_kind: string,
    target_id: string,
    name = material_id,
  ) => ({
    material_id,
    target_kind,
    target_id,
    material_name: name,
  });
  const links = [
    link('m-a1-2', 'task', 'a1', '02 - segundo'),
    link('m-a1-1', 'task', 'a1', '01 - primeiro'),
    link('m-p2', 'page', 'p2'),
    link('m-a1-1', 'task', 'a1', '01 - primeiro'),
  ];
  const steps = studySequence([{ id: 'p1' }, { id: 'p2' }], tasks, links);

  it('lista por lista, mãe antes das filhas, o material logo depois da tarefa', () => {
    expect(steps).toEqual([
      { kind: 'task', id: 'a' },
      { kind: 'task', id: 'a1' },
      { kind: 'material', id: 'm-a1-1', task: 'a1' },
      { kind: 'material', id: 'm-a1-2', task: 'a1' },
      { kind: 'task', id: 'a2' },
      { kind: 'task', id: 'b' },
      { kind: 'material', id: 'm-p2', task: 'c' },
      { kind: 'task', id: 'c' },
    ]);
  });

  it('acha a tarefa e o material (o da tarefa dada, senão o primeiro)', () => {
    expect(stepIndex(steps, { kind: 'task', id: 'a2' })).toBe(4);
    expect(stepIndex(steps, { kind: 'material', id: 'm-a1-2', task: 'a1' })).toBe(3);
    expect(stepIndex(steps, { kind: 'material', id: 'm-a1-2', task: 'x' })).toBe(3);
    expect(stepIndex(steps, { kind: 'material', id: 'nada' })).toBe(-1);
  });
});
