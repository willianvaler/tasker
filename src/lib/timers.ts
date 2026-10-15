import type { Tables } from './db';

// Temporizadores (V3 §4.2, D124). O que vale é o horário absoluto: o restante é sempre calculado
// de `ends_at` − agora, nunca contado no aparelho. Espelho do `update_timer` do banco.

export type Timer = Tables<'timers'>;
export type TimerKind = 'rest' | 'pomodoro' | 'stopwatch' | 'countdown';
export type TimerAction = 'adjust' | 'pause' | 'resume' | 'done' | 'skip' | 'cancel';

export const isActive = (timer: Pick<Timer, 'state'>) =>
  timer.state === 'running' || timer.state === 'paused';

const ms = (iso: string | null) => (iso ? Date.parse(iso) : NaN);
const at = (t: number) => new Date(t).toISOString();

/** Segundos que faltam (cronômetro: os que já passaram). Nunca negativo. */
export function timerSeconds(timer: Timer, now: number): number {
  if (timer.state === 'paused') return timer.paused_seconds ?? 0;
  if (timer.kind === 'stopwatch') {
    const end = isActive(timer) ? now : ms(timer.ends_at);
    return Math.max(0, Math.floor((end - ms(timer.started_at)) / 1000));
  }
  if (!isActive(timer)) return 0;
  return Math.max(0, Math.ceil((ms(timer.ends_at) - now) / 1000));
}

/** Contagem regressiva que já chegou ao fim (ainda não marcada como feita). */
export const timerElapsed = (timer: Timer, now: number) =>
  timer.state === 'running' && timer.kind !== 'stopwatch' && ms(timer.ends_at) <= now;

/** "1:30", "12:05", "1:02:03" */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** O timer depois de uma ação (o que o aparelho mostra antes do servidor confirmar). */
export function applyTimerAction(
  timer: Timer,
  action: TimerAction,
  now: number,
  seconds = 0,
): Timer {
  if (!isActive(timer)) return timer;
  const next = { ...timer, updated_at: at(now) };
  switch (action) {
    case 'adjust':
      if (timer.kind === 'stopwatch') return timer;
      if (timer.state === 'paused')
        return { ...next, paused_seconds: Math.max((timer.paused_seconds ?? 0) + seconds, 1) };
      return { ...next, ends_at: at(Math.max(ms(timer.ends_at) + seconds * 1000, now)) };
    case 'pause':
      if (timer.state !== 'running') return timer;
      return {
        ...next,
        state: 'paused',
        paused_seconds:
          timer.kind === 'stopwatch'
            ? Math.max(0, Math.floor((now - ms(timer.started_at)) / 1000))
            : Math.max(1, Math.ceil((ms(timer.ends_at) - now) / 1000)),
      };
    case 'resume': {
      if (timer.state !== 'paused') return timer;
      const paused = (timer.paused_seconds ?? 0) * 1000;
      return timer.kind === 'stopwatch'
        ? { ...next, state: 'running', started_at: at(now - paused), paused_seconds: null }
        : { ...next, state: 'running', ends_at: at(now + paused), paused_seconds: null };
    }
    default: {
      const state = action === 'done' ? 'done' : action === 'skip' ? 'skipped' : 'cancelled';
      const ends_at =
        timer.kind === 'stopwatch'
          ? timer.paused_seconds != null
            ? at(ms(timer.started_at) + timer.paused_seconds * 1000)
            : at(now)
          : timer.ends_at;
      return { ...next, state, ended_at: at(now), ends_at };
    }
  }
}
