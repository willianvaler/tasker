import { describe, expect, test } from '@jest/globals';

import { summarize, toggled, type Reaction } from '../reactions';

const r = (user_id: string, emoji: string, comment_id: string | null = null): Reaction => ({
  id: `${user_id}${emoji}${comment_id}`,
  task_id: 't1',
  comment_id,
  user_id,
  emoji,
});

describe('summarize', () => {
  const all = [r('ana', '🔥'), r('bia', '👏'), r('ana', '👏'), r('bia', '❤️', 'c1')];
  test('conta por emoji na ordem da lista e marca a minha', () => {
    expect(summarize(all, { taskId: 't1' }, 'ana')).toEqual([
      { emoji: '👏', count: 2, mine: true },
      { emoji: '🔥', count: 1, mine: true },
    ]);
  });
  test('reação do comentário fica no comentário', () => {
    expect(summarize(all, { taskId: 't1', commentId: 'c1' }, 'ana')).toEqual([
      { emoji: '❤️', count: 1, mine: false },
    ]);
  });
  test('sem sessão nada é meu', () => {
    expect(summarize(all, { taskId: 't1' }, undefined).every((s) => !s.mine)).toBe(true);
  });
});

describe('toggled', () => {
  test('liga e desliga', () => {
    const on = toggled([], { taskId: 't1' }, '🎉', 'ana', 'x');
    expect(on).toEqual([{ id: 'x', task_id: 't1', comment_id: null, user_id: 'ana', emoji: '🎉' }]);
    expect(toggled(on, { taskId: 't1' }, '🎉', 'ana', 'y')).toEqual([]);
  });
  test('desligar a minha não tira a do outro', () => {
    const list = [r('ana', '👏'), r('bia', '👏')];
    expect(toggled(list, { taskId: 't1' }, '👏', 'ana', 'z')).toEqual([r('bia', '👏')]);
  });
});
