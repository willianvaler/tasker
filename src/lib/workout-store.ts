import { localStore } from './storage';

// Andamento do Modo Treino no aparelho, por página (D127): início, pausas, séries, volume, XP,
// pulados e a sessão do servidor. Sair e voltar continua de onde parou.

export type WorkoutRun = {
  startedAt: number;
  pausedMs: number;
  pausedAt: number | null;
  sets: number;
  volume: number;
  xp: number;
  skipped: string[];
  /** Sessão no servidor (AC10.1): voltar ao treino entra de novo nela em vez de perguntar */
  serverSession?: string | null;
};

const key = (pageId: string) => `questlist:workout:${pageId}`;
// Treino aberto há mais de 12 h é outro treino
const MAX_MS = 12 * 60 * 60 * 1000;

/**
 * Andamento guardado do treino desta página. `resumed`: já tinha começado (série, pulo ou sessão
 * no servidor), então voltar continua de onde parou, sem o seletor de quem treina junto.
 */
export function loadWorkoutRun(pageId: string): { run: WorkoutRun; resumed: boolean } {
  const fresh: WorkoutRun = {
    startedAt: Date.now(),
    pausedMs: 0,
    pausedAt: null,
    sets: 0,
    volume: 0,
    xp: 0,
    skipped: [],
  };
  try {
    const saved = JSON.parse(localStore.getItem(key(pageId)) ?? 'null') as WorkoutRun | null;
    if (!saved || Date.now() - saved.startedAt >= MAX_MS) return { run: fresh, resumed: false };
    return {
      run: saved,
      resumed: saved.sets > 0 || saved.skipped.length > 0 || !!saved.serverSession,
    };
  } catch {
    return { run: fresh, resumed: false };
  }
}

// Quem mostra "Continuar treino" é avisado a cada mudança
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());

export function saveWorkoutRun(pageId: string, run: WorkoutRun) {
  localStore.setItem(key(pageId), JSON.stringify(run));
  changed();
}

export function clearWorkoutRun(pageId: string) {
  localStore.removeItem(key(pageId));
  changed();
}

/** Para o `useSyncExternalStore`. */
export function subscribeWorkoutRuns(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Há treino começado nesta página (o botão da página diz "Continuar treino"). */
export const workoutInProgress = (pageId: string) => loadWorkoutRun(pageId).resumed;
