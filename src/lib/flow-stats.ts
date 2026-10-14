// Indicadores do fluxo (V3 §2.7), em linguagem simples: o que mais segura o projeto (gargalos) e
// quem tem tarefa atrasada. Funções puras, com teste; os tempos médios vêm do servidor
// (project_flow_stats).

import type { FlowDep, FlowPerson, FlowTask } from './flow-graph';
import { taskState } from './task-state';

export type Bottleneck = { id: string; title: string; holds: number };

/**
 * Tarefas abertas que mais seguram outras: conta as bloqueadas que esperam por ela, direto ou em
 * cadeia (o fogo espera o carvão; a carne espera o fogo: o carvão segura as duas).
 */
export function bottlenecks(
  tasks: ReadonlyMap<string, FlowTask>,
  deps: readonly FlowDep[],
  { now = new Date(), limit = 3 }: { now?: Date; limit?: number } = {},
): Bottleneck[] {
  const involved = new Set(deps.map((d) => d.task_id));
  const waiting = new Map<string, string[]>();
  for (const id of involved) {
    const s = taskState(id, tasks, deps, now);
    if (s.state === 'blocked') waiting.set(id, s.waitingOn);
  }
  const holds = new Map<string, Set<string>>();
  for (const blocked of waiting.keys()) {
    // Sobe a cadeia até quem não espera ninguém (as raízes do bloqueio)
    const seen = new Set<string>();
    const stack = [...(waiting.get(blocked) ?? [])];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const up = waiting.get(id);
      if (up) stack.push(...up);
    }
    for (const id of seen) {
      const task = tasks.get(id);
      if (!task || task.status === 'done') continue;
      holds.set(id, (holds.get(id) ?? new Set()).add(blocked));
    }
  }
  return (
    [...holds.entries()]
      .map(([id, set]) => ({ id, title: tasks.get(id)?.title ?? '', holds: set.size }))
      // Primeiro quem segura mais; no empate, quem não espera ninguém (é por onde começar)
      .sort(
        (a, b) =>
          b.holds - a.holds ||
          Number(waiting.has(a.id)) - Number(waiting.has(b.id)) ||
          a.title.localeCompare(b.title),
      )
      .slice(0, limit)
  );
}

export type Overdue = { name: string; count: number };

/** Tarefas abertas com data passada, por pessoa (folhas; mãe com filhas é pacote). */
export function overdueByPerson(
  tasks: ReadonlyMap<string, FlowTask & { due_date: string | null }>,
  people: ReadonlyMap<string, FlowPerson[]>,
  today: string,
): Overdue[] {
  const parents = new Set([...tasks.values()].map((t) => t.parent_task_id).filter(Boolean));
  const counts = new Map<string, number>();
  for (const t of tasks.values()) {
    if (t.status === 'done' || !t.due_date || t.due_date >= today || parents.has(t.id)) continue;
    const who = people.get(t.id) ?? [];
    for (const name of who.length ? who.map((p) => p.name) : ['']) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || (a.name || '￿').localeCompare(b.name || '￿'));
}
