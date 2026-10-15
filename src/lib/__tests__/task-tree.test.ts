import { describe, expect, test } from '@jest/globals';

import {
  branchHeight,
  leafActuals,
  leafWeightedProgress,
  branchRows,
  childrenMap,
  dueAfterParent,
  levelOf,
  planIndent,
  planOutdent,
  formatDuration,
  leafEstimates,
  leafProgress,
  parentIds,
  parseDuration,
  wbsCodes,
  wbsOutline,
} from '../task-tree';

const task = (id: string, parent: string | null, done = false) => ({
  id,
  parent_task_id: parent,
  status: done ? 'done' : 'todo',
});

describe('progresso pelas folhas', () => {
  test('conta só as folhas do galho inteiro', () => {
    const tasks = [
      task('mudar', null),
      task('cozinha', 'mudar'),
      task('louca', 'cozinha', true),
      task('panelas', 'cozinha'),
      task('sala', 'mudar', true),
      task('solta', null, true),
    ];
    const p = leafProgress(tasks);
    expect(p.get('mudar')).toEqual({ done: 2, total: 3 });
    expect(p.get('cozinha')).toEqual({ done: 1, total: 2 });
    // Folhas e tarefas sem filhas não entram no mapa
    expect(p.has('louca')).toBe(false);
    expect(p.has('solta')).toBe(false);
  });

  test('a mãe concluída não conta como folha', () => {
    const p = leafProgress([task('a', null, true), task('b', 'a', true), task('c', 'a')]);
    expect(p.get('a')).toEqual({ done: 1, total: 2 });
  });

  test('não trava com ciclo em dado local', () => {
    expect(() => leafProgress([task('a', 'b'), task('b', 'a')])).not.toThrow();
  });
});

describe('estimativa e datas', () => {
  const est = (id: string, parent: string | null, minutes: number | null) => ({
    ...task(id, parent),
    estimate_minutes: minutes,
  });

  test('a mãe soma as folhas do galho inteiro (a estimativa da própria mãe não conta)', () => {
    const e = leafEstimates([
      est('mudar', null, 999),
      est('cozinha', 'mudar', 999),
      est('louca', 'cozinha', 30),
      est('panelas', 'cozinha', null),
      est('sala', 'mudar', 90),
    ]);
    expect(e.get('cozinha')).toBe(30);
    expect(e.get('mudar')).toBe(120);
    expect(e.has('sala')).toBe(false);
  });

  test('lê e escreve duração', () => {
    expect(parseDuration('90')).toBe(90);
    expect(parseDuration('45m')).toBe(45);
    expect(parseDuration('1h30')).toBe(90);
    expect(parseDuration('1h 30min')).toBe(90);
    expect(parseDuration('1,5h')).toBe(90);
    expect(parseDuration('2h')).toBe(120);
    expect(parseDuration('amanhã')).toBeNull();
    expect(parseDuration('0')).toBeNull();
    expect(formatDuration(90)).toBe('1h30');
    expect(formatDuration(45)).toBe('45min');
    expect(formatDuration(120)).toBe('2h');
    expect(formatDuration(65)).toBe('1h05');
  });

  test('data da filha depois da mãe', () => {
    expect(dueAfterParent('2026-10-20', '2026-10-18')).toBe(true);
    expect(dueAfterParent('2026-10-18', '2026-10-18')).toBe(false);
    expect(dueAfterParent(null, '2026-10-18')).toBe(false);
    expect(dueAfterParent('2026-10-20', null)).toBe(false);
  });
});

describe('teclado na árvore', () => {
  const t = (id: string, parent: string | null, position: number) => ({
    ...task(id, parent),
    position,
  });
  // a (b (c)), d, e
  const tasks = [t('a', null, 1), t('b', 'a', 1), t('c', 'b', 1), t('d', null, 2), t('e', null, 3)];

  test('linhas visíveis só descem nas expandidas', () => {
    const kids = childrenMap(tasks);
    const a = tasks[0];
    expect(branchRows(a, kids, new Set())).toEqual([]);
    expect(
      branchRows(a, kids, new Set(['a'])).map((r) => [r.task.id, r.level, r.hasChildren]),
    ).toEqual([['b', 2, true]]);
    expect(branchRows(a, kids, new Set(['a', 'b'])).map((r) => r.task.id)).toEqual(['b', 'c']);
  });

  test('Tab vira filha da irmã de cima', () => {
    expect(planIndent(tasks[3], tasks, 5)).toEqual({ ok: true, parentId: 'a', position: 2 });
    expect(planIndent(tasks[0], tasks, 5)).toEqual({ ok: false, reason: 'first' });
    expect(planIndent(tasks[1], tasks, 5)).toEqual({ ok: false, reason: 'first' });
  });

  test('Tab respeita o limite de níveis contando o galho que vai junto', () => {
    // d entra em a (nível 2): ok com limite 2; c já está no 3
    expect(planIndent(tasks[3], tasks, 2).ok).toBe(true);
    const deep = [...tasks, t('f', 'd', 1)];
    // d (com filha) entraria no nível 2 levando f para o 3
    expect(planIndent(deep[3], deep, 2)).toEqual({ ok: false, reason: 'limit' });
  });

  test('Shift+Tab vira irmã da mãe, logo depois dela', () => {
    expect(planOutdent(tasks[2], tasks)).toEqual({ ok: true, parentId: 'a', position: 2 });
    expect(planOutdent(tasks[1], tasks)).toEqual({ ok: true, parentId: null, position: 1.5 });
    expect(planOutdent(tasks[0], tasks)).toEqual({ ok: false, reason: 'root' });
  });

  test('nível e altura do galho', () => {
    const byId = new Map(tasks.map((x) => [x.id, x]));
    expect(levelOf(tasks[2], byId)).toBe(3);
    expect(branchHeight('a', childrenMap(tasks))).toBe(3);
    expect(branchHeight('e', childrenMap(tasks))).toBe(1);
  });
});

describe('códigos WBS', () => {
  const t = (id: string, parent: string | null, position: number, title = id, done = false) => ({
    ...task(id, parent, done),
    position,
    title,
  });
  const tasks = [
    t('b', null, 2, 'Festa'),
    t('a', null, 1, 'Mudar'),
    t('a2', 'a', 2, 'Sala', true),
    t('a1', 'a', 1, 'Cozinha'),
    t('a1x', 'a1', 1, 'Louça'),
  ];

  test('numeração pela posição, em qualquer nível', () => {
    const codes = wbsCodes(tasks);
    expect(codes.get('a')).toBe('1');
    expect(codes.get('a1')).toBe('1.1');
    expect(codes.get('a1x')).toBe('1.1.1');
    expect(codes.get('a2')).toBe('1.2');
    expect(codes.get('b')).toBe('2');
  });

  test('texto exportado com recuo e concluídas marcadas', () => {
    expect(wbsOutline(tasks)).toBe(
      '1 Mudar\n  1.1 Cozinha\n    1.1.1 Louça\n  1.2 Sala [x]\n2 Festa',
    );
    expect(parentIds(tasks).sort()).toEqual(['a', 'a1']);
  });
});

test('tempo feito sobe pelas folhas (K3)', () => {
  const sums = leafActuals([
    { id: 'm', parent_task_id: null, actual_minutes: 999 },
    { id: 'a', parent_task_id: 'm', actual_minutes: 25 },
    { id: 'b', parent_task_id: 'm', actual_minutes: 50 },
  ]);
  expect(sums.get('m')).toBe(75);
});

test('progresso da mãe pelo peso (M3)', () => {
  const pct = leafWeightedProgress([
    { id: 'm', parent_task_id: null, status: 'todo', weight: null },
    { id: 'a', parent_task_id: 'm', status: 'done', weight: 3 },
    { id: 'b', parent_task_id: 'm', status: 'todo', weight: null },
  ]);
  expect(pct.get('m')).toBe(75);
});
