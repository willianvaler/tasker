import type { TaskState } from './task-state';

/** O que a linha da tarefa precisa saber do fluxo (só para tarefas com pré-requisitos). */
export type RowFlow = {
  state: TaskState;
  /** Títulos do que ela espera (bloqueada) */
  waiting: string[];
  /** Só o atraso segura: libera nesta hora */
  readyAt?: string;
  /** Bloqueada, mas quem vê pode forçar (projeto flexível + task.force_unblock) */
  forceable: boolean;
};

export const sameFlow = (a?: RowFlow, b?: RowFlow) =>
  a === b ||
  (!!a &&
    !!b &&
    a.state === b.state &&
    a.forceable === b.forceable &&
    a.readyAt === b.readyAt &&
    a.waiting.join('|') === b.waiting.join('|'));
