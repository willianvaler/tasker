import { describe, expect, it } from '@jest/globals';

import { nextAction, remainingEstimate } from '../next-action';

const t = (
  id: string,
  over: Partial<{
    status: string;
    priority: number;
    due_date: string | null;
    blocked: boolean;
  }> = {},
) => ({
  id,
  status: 'todo',
  priority: 0,
  due_date: null as string | null,
  ...over,
});
const today = '2026-10-15';

describe('nextAction', () => {
  it('em andamento primeiro', () =>
    expect(
      nextAction([t('a', { due_date: '2026-10-01' }), t('b', { status: 'doing' })], [], today)?.id,
    ).toBe('b'));
  it('depois o Meu dia, na ordem', () =>
    expect(nextAction([t('a', { due_date: today }), t('b'), t('c')], ['c', 'b'], today)?.id).toBe(
      'c',
    ));
  it('atrasada antes da de hoje; prioridade desempata', () => {
    expect(
      nextAction(
        [t('a', { due_date: today, priority: 3 }), t('b', { due_date: '2026-10-10' })],
        [],
        today,
      )?.id,
    ).toBe('b');
    expect(
      nextAction([t('a', { due_date: today }), t('b', { due_date: today, priority: 2 })], [], today)
        ?.id,
    ).toBe('b');
  });
  it('bloqueada e concluída ficam de fora', () =>
    expect(
      nextAction(
        [t('a', { blocked: true, due_date: today }), t('b', { status: 'done', due_date: today })],
        [],
        today,
      ),
    ).toBeNull());
  it('sem data e fora do Meu dia não é sugestão', () =>
    expect(nextAction([t('a')], [], today)).toBeNull());
});

it('tempo que falta no Meu dia', () =>
  expect(
    remainingEstimate([
      { status: 'todo', estimate_minutes: 30 },
      { status: 'done', estimate_minutes: 60 },
      { status: 'todo', estimate_minutes: null },
    ]),
  ).toBe(30));
