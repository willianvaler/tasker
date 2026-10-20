// Matriz de Eisenhower (V3 §6 B, D221): visão alternativa da página de lista.
// Importante = prioridade "!!" ou "!!!"; urgente = vence até daqui a URGENT_DAYS dias (atrasada conta).
// Mover de quadrante muda só a prioridade e a data, que são o que a matriz lê.

import { addDays } from './parser/dates';

export type Quadrant = 'do' | 'plan' | 'delegate' | 'drop';
export const QUADRANTS: readonly Quadrant[] = ['do', 'plan', 'delegate', 'drop'];

/** Prioridade a partir da qual a tarefa é importante. */
export const IMPORTANT_PRIORITY = 2;
/** Vence até hoje + N dias: urgente. */
export const URGENT_DAYS = 2;
/** Ao tirar a urgência de uma tarefa com data, ela vai para daqui a uma semana. */
export const PLAN_AHEAD_DAYS = 7;

type MatrixTask = { priority: number; due_date: string | null };

export function isImportant(task: MatrixTask) {
  return task.priority >= IMPORTANT_PRIORITY;
}

export function isUrgent(task: MatrixTask, today: string) {
  return task.due_date !== null && task.due_date <= addDays(today, URGENT_DAYS);
}

export function quadrantOf(task: MatrixTask, today: string): Quadrant {
  const important = isImportant(task);
  const urgent = isUrgent(task, today);
  if (important) return urgent ? 'do' : 'plan';
  return urgent ? 'delegate' : 'drop';
}

/** Separa as tarefas pelos quatro quadrantes, mantendo a ordem de entrada. */
export function splitByQuadrant<T extends MatrixTask>(tasks: T[], today: string) {
  const result: Record<Quadrant, T[]> = { do: [], plan: [], delegate: [], drop: [] };
  for (const task of tasks) result[quadrantOf(task, today)].push(task);
  return result;
}

/** O que mudar na tarefa para ela cair no quadrante pedido (vazio se já está nele). */
export function moveToQuadrant(
  task: MatrixTask,
  target: Quadrant,
  today: string,
): Partial<MatrixTask> {
  const patch: Partial<MatrixTask> = {};
  const wantImportant = target === 'do' || target === 'plan';
  const wantUrgent = target === 'do' || target === 'delegate';
  if (wantImportant && !isImportant(task)) patch.priority = IMPORTANT_PRIORITY;
  if (!wantImportant && isImportant(task)) patch.priority = 0;
  if (wantUrgent && !isUrgent(task, today)) patch.due_date = today;
  // Sem data já não é urgente; com data, empurra para a semana que vem
  if (!wantUrgent && isUrgent(task, today)) patch.due_date = addDays(today, PLAN_AHEAD_DAYS);
  return patch;
}
