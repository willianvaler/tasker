import { describe, expect, it } from '@jest/globals';

import { applyTimerAction, formatClock, timerElapsed, timerSeconds, type Timer } from '../timers';

// Mesmos casos do supabase/tests/timers.test.sql (update_timer)
const t = (iso: string) => Date.parse(iso);
const base: Timer = {
  id: 'a',
  user_id: 'u',
  task_id: null,
  kind: 'rest',
  state: 'running',
  started_at: '2026-10-14T10:00:00.000Z',
  ends_at: '2026-10-14T10:01:30.000Z',
  paused_seconds: null,
  duration_seconds: 90,
  ended_at: null,
  device_id: null,
  config: {},
  updated_at: '2026-10-14T10:00:00.000Z',
};

describe('timerSeconds', () => {
  it('restante vem do fim absoluto', () =>
    expect(timerSeconds(base, t('2026-10-14T10:01:00Z'))).toBe(30));
  it('arredonda para cima (1:29,5 → 30)', () =>
    expect(timerSeconds(base, t('2026-10-14T10:01:00.500Z'))).toBe(30));
  it('passou do fim: zero', () => expect(timerSeconds(base, t('2026-10-14T11:00:00Z'))).toBe(0));
  it('cronômetro conta para cima', () =>
    expect(
      timerSeconds({ ...base, kind: 'stopwatch', ends_at: null }, t('2026-10-14T10:02:00Z')),
    ).toBe(120));
});

describe('applyTimerAction', () => {
  it('+30 s empurra o fim', () =>
    expect(applyTimerAction(base, 'adjust', t('2026-10-14T10:00:10Z'), 30).ends_at).toBe(
      '2026-10-14T10:02:00.000Z',
    ));
  it('−30 s nunca volta antes de agora', () =>
    expect(applyTimerAction(base, 'adjust', t('2026-10-14T10:00:20Z'), -600).ends_at).toBe(
      '2026-10-14T10:00:20.000Z',
    ));
  it('pausar guarda o que falta e retomar recalcula o fim', () => {
    const paused = applyTimerAction(base, 'pause', t('2026-10-14T10:01:00Z'));
    expect(paused).toMatchObject({ state: 'paused', paused_seconds: 30 });
    expect(applyTimerAction(paused, 'resume', t('2026-10-14T10:05:00Z')).ends_at).toBe(
      '2026-10-14T10:05:30.000Z',
    );
  });
  it('pular termina', () =>
    expect(applyTimerAction(base, 'skip', t('2026-10-14T10:00:30Z')).state).toBe('skipped'));
  it('terminado não muda', () => {
    const done = { ...base, state: 'done' };
    expect(applyTimerAction(done, 'adjust', t('2026-10-14T10:00:30Z'), 30)).toBe(done);
  });
});

describe('timerElapsed e formatClock', () => {
  it('chegou ao fim', () => expect(timerElapsed(base, t('2026-10-14T10:01:30Z'))).toBe(true));
  it('ainda não', () => expect(timerElapsed(base, t('2026-10-14T10:01:29Z'))).toBe(false));
  it.each([
    [90, '1:30'],
    [5, '0:05'],
    [3723, '1:02:03'],
  ])('%i s → %s', (s, text) => expect(formatClock(s)).toBe(text));
});
