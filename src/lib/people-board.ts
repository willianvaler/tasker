// Visão Pessoas (V3 §2.6): "quem está fazendo o quê". Uma coluna por pessoa com o que ela está
// fazendo agora, o que está pronto para ela, o que espera e o que já concluiu. Função pura, com teste.

import type { FlowDep, FlowPerson, FlowTask } from './flow-graph';
import { taskState, type TaskState } from './task-state';

export type BoardTask = {
  id: string;
  title: string;
  waitingOn: string[];
  completedAt: string | null;
};
export type PersonColumn = {
  /** userId, `name:<nome pendente>` ou '' (sem responsável) */
  key: string;
  name: string;
  userId: string | null;
  doing: BoardTask[];
  ready: BoardTask[];
  blocked: BoardTask[];
  done: BoardTask[];
};

export function peopleBoard({
  tasks,
  deps,
  people,
  members,
  me,
  now = new Date(),
}: {
  tasks: ReadonlyMap<string, FlowTask>;
  deps: readonly FlowDep[];
  people: ReadonlyMap<string, FlowPerson[]>;
  members: readonly { userId: string; displayName: string }[];
  me?: string;
  now?: Date;
}): PersonColumn[] {
  const columns = new Map<string, PersonColumn>();
  const column = (key: string, name: string, userId: string | null) => {
    let col = columns.get(key);
    if (!col) {
      col = { key, name, userId, doing: [], ready: [], blocked: [], done: [] };
      columns.set(key, col);
    }
    return col;
  };
  // Todo membro aparece, mesmo sem tarefa
  for (const m of members) column(m.userId, m.displayName, m.userId);

  // Mãe com filhas é um pacote: conta quem faz as filhas
  const parents = new Set([...tasks.values()].map((t) => t.parent_task_id).filter(Boolean));
  const bucket: Record<TaskState, 'doing' | 'ready' | 'blocked' | 'done'> = {
    doing: 'doing',
    ready: 'ready',
    blocked: 'blocked',
    done: 'done',
  };
  for (const task of tasks.values()) {
    if (parents.has(task.id)) continue;
    const s = taskState(task.id, tasks, deps, now);
    const item: BoardTask = {
      id: task.id,
      title: task.title,
      waitingOn: s.waitingOn,
      completedAt: task.completed_at,
    };
    const who = people.get(task.id) ?? [];
    const targets = who.length
      ? who.map((p) => column(p.userId ?? `name:${p.name}`, p.name, p.userId))
      : [column('', '', null)];
    for (const col of targets) col[bucket[s.state]].push(item);
  }

  const byTitle = (a: BoardTask, b: BoardTask) => a.title.localeCompare(b.title);
  for (const col of columns.values()) {
    col.doing.sort(byTitle);
    col.ready.sort(byTitle);
    col.blocked.sort(byTitle);
    col.done.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  }
  // Eu primeiro, depois por nome; sem responsável no fim (e só se tiver tarefa)
  return [...columns.values()]
    .filter((c) => c.key !== '' || c.doing.length + c.ready.length + c.blocked.length > 0)
    .sort((a, b) => {
      if (!a.key) return 1;
      if (!b.key) return -1;
      if (me && a.userId === me) return -1;
      if (me && b.userId === me) return 1;
      return a.name.localeCompare(b.name);
    });
}
