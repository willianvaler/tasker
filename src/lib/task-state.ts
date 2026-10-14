// Estado de execução (V3 §2.2): `bloqueada` e `pronta` são derivadas dos pré-requisitos, nunca
// guardadas. Espelho de public.task_state() (mesmos casos de teste em task-state.test.ts e no
// pgTAP dependencias_estado). Calcula a partir do banco do aparelho, para funcionar offline.

export type TaskState = 'done' | 'blocked' | 'ready' | 'doing';

export type StateTask = {
  id: string;
  parent_task_id: string | null;
  status: string;
  completed_at: string | null;
  started_at: string | null;
  deps_mode: string;
  /** Lista da tarefa: conta quando a lista depende de outra (V3 §2.3) */
  page_id?: string;
};
export type StateDep = { task_id: string; depends_on_task_id: string; lag_minutes: number };

export type StateResult = {
  state: TaskState;
  /** Pré-requisitos que ainda seguram a tarefa (dela ou das mães) */
  waitingOn: string[];
  /** Tudo concluído, só falta o atraso: libera a partir daqui */
  readyAt?: string;
  /** A lista da tarefa espera outra lista chegar ao percentual (page_blockers) */
  pageBlocked?: true;
};

/** A ligação está atendida? (pré-requisito concluído e o atraso já passou) */
function satisfied(pre: StateTask | undefined, lag: number, now: number) {
  if (!pre) return { ok: true as const };
  if (pre.status !== 'done' || !pre.completed_at) return { ok: false as const };
  const at = Date.parse(pre.completed_at) + lag * 60_000;
  return at <= now ? { ok: true as const } : { ok: false as const, at };
}

const EMPTY: ReadonlySet<string> = new Set();

export function taskState(
  taskId: string,
  tasks: ReadonlyMap<string, StateTask>,
  deps: readonly StateDep[],
  now: Date = new Date(),
  /** Listas bloqueadas por outra lista (lib/page-deps.ts) */
  blockedPages: ReadonlySet<string> = EMPTY,
): StateResult {
  const task = tasks.get(taskId);
  if (!task) return { state: 'ready', waitingOn: [] };
  if (task.status === 'done') return { state: 'done', waitingOn: [] };

  const waiting = new Set<string>();
  let lagUntil = 0;
  let blocked = false;
  // A tarefa e as mães dela: a filha herda os bloqueios de cima
  const seen = new Set<string>();
  for (let level: StateTask | undefined = task; level && !seen.has(level.id);) {
    seen.add(level.id);
    const mine = deps.filter((d) => d.task_id === level!.id);
    if (mine.length) {
      const checks = mine.map((d) => ({
        id: d.depends_on_task_id,
        ...satisfied(tasks.get(d.depends_on_task_id), d.lag_minutes, now.getTime()),
      }));
      const open = checks.filter((c) => !c.ok);
      const levelBlocked =
        level.deps_mode === 'any' ? open.length === checks.length : open.length > 0;
      if (levelBlocked) {
        blocked = true;
        for (const c of open) {
          waiting.add(c.id);
          if ('at' in c && c.at) lagUntil = Math.max(lagUntil, c.at);
        }
      }
    }
    level = level.parent_task_id ? tasks.get(level.parent_task_id) : undefined;
  }

  const pageBlocked = !!task.page_id && blockedPages.has(task.page_id);
  if (blocked) {
    // Só o atraso segura: todos os que esperam já estão concluídos
    const onlyLag = [...waiting].every((id) => tasks.get(id)?.status === 'done');
    return {
      state: 'blocked',
      waitingOn: [...waiting],
      ...(onlyLag && lagUntil && !pageBlocked ? { readyAt: new Date(lagUntil).toISOString() } : {}),
      ...(pageBlocked ? { pageBlocked: true as const } : {}),
    };
  }
  if (pageBlocked) return { state: 'blocked', waitingOn: [], pageBlocked: true };
  return { state: task.started_at ? 'doing' : 'ready', waitingOn: [] };
}
