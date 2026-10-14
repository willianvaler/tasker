import { describe, expect, test } from '@jest/globals';

import { leafProgress } from '../task-tree';

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
