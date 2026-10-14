import { describe, expect, test } from '@jest/globals';

import {
  dueAfterParent,
  formatDuration,
  leafEstimates,
  leafProgress,
  parseDuration,
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
