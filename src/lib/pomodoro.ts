// Pomodoro (V3 §5.1, D129): fases, ciclos e sugestões de pausa. Funções puras; o timer é o da J2
// (kind 'pomodoro', fase no config) e o tempo de foco vira registro no servidor.

export type PomodoroPhase = 'focus' | 'short' | 'long';

export type PomodoroSettings = {
  focus_minutes: number;
  short_break_minutes: number;
  long_break_minutes: number;
  cycles: number;
  auto_start: boolean;
  /** null = as sugestões padrão do idioma */
  break_ideas: string[] | null;
  idea_order: 'random' | 'sequence';
};

export const DEFAULT_POMODORO: PomodoroSettings = {
  focus_minutes: 25,
  short_break_minutes: 5,
  long_break_minutes: 15,
  cycles: 4,
  auto_start: false,
  break_ideas: null,
  idea_order: 'random',
};

/** O que o config do timer do pomodoro guarda. */
export type PomodoroConfig = {
  phase: PomodoroPhase;
  /** Qual foco do ciclo (1 a `cycles`) */
  cycle: number;
  label?: string;
  /** Sugestão de pausa escolhida no início do foco (o aviso do fim já leva) */
  idea?: string;
};

export function phaseSeconds(settings: PomodoroSettings, phase: PomodoroPhase) {
  const minutes =
    phase === 'focus'
      ? settings.focus_minutes
      : phase === 'short'
        ? settings.short_break_minutes
        : settings.long_break_minutes;
  return minutes * 60;
}

/** Depois do foco n: pausa curta, ou longa no último do ciclo; depois da pausa, o próximo foco. */
export function nextPhase(
  current: Pick<PomodoroConfig, 'phase' | 'cycle'>,
  cycles: number,
): Pick<PomodoroConfig, 'phase' | 'cycle'> {
  if (current.phase === 'focus')
    return { phase: current.cycle >= cycles ? 'long' : 'short', cycle: current.cycle };
  if (current.phase === 'long') return { phase: 'focus', cycle: 1 };
  return { phase: 'focus', cycle: current.cycle + 1 };
}

/** Sugestão de pausa: em ordem (pelo número do foco) ou sorteada. */
export function pickIdea(
  ideas: readonly string[],
  order: PomodoroSettings['idea_order'],
  index: number,
  random: () => number = Math.random,
) {
  if (ideas.length === 0) return undefined;
  const i = order === 'sequence' ? index : Math.floor(random() * ideas.length);
  return ideas[((i % ideas.length) + ideas.length) % ideas.length];
}

/** Pomodoros estimados para a tarefa: a estimativa dividida pelo foco, para cima. */
export function estimatedPomodoros(
  estimateMinutes: number | null | undefined,
  focusMinutes: number,
) {
  if (!estimateMinutes || focusMinutes <= 0) return null;
  return Math.ceil(estimateMinutes / focusMinutes);
}
