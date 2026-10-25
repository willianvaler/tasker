import { weekdayOf, type IsoDate } from './parser/dates';

// Dieta (BE2, ESCOPO_V10 §5, D275): o cardápio da semana é uma lista comum com reinício semanal.
// Cada prato é uma tarefa sem data, com a refeição e os dias da semana no `meta` ({ meal, days }) e
// os ingredientes nas subtarefas, que é o que a lista de compras já lê (D224). Sem data, prato não
// comido não vira "atrasada"; marcado, fica marcado até a semana virar.

export const MEALS = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
export type Meal = (typeof MEALS)[number];

/** Segunda primeiro, domingo no fim (0 = domingo, como no banco). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export type DietTask = {
  id: string;
  title: string;
  parent_task_id: string | null;
  position: number;
  meta: unknown;
  status: string;
};

export function mealOf(task: Pick<DietTask, 'meta'>): Meal {
  const meal = (task.meta as { meal?: unknown } | null)?.meal;
  return (MEALS as readonly unknown[]).includes(meal) ? (meal as Meal) : 'lunch';
}

/** Dias da semana do prato (0 = domingo; vazio: sem dia, aparece em "Sem dia"). */
export function dishDays(task: Pick<DietTask, 'meta'>): number[] {
  const days = (task.meta as { days?: unknown } | null)?.days;
  if (!Array.isArray(days)) return [];
  return [
    ...new Set(days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)),
  ].sort((a, b) => a - b);
}

/** Pratos (primeiro nível) por dia da semana e refeição, na ordem da lista. */
export function weekGrid(tasks: DietTask[]) {
  const dishes = tasks.filter((t) => !t.parent_task_id).sort((a, b) => a.position - b.position);
  const grid = new Map<number, Record<Meal, DietTask[]>>();
  for (const day of WEEK_ORDER) grid.set(day, { breakfast: [], lunch: [], snack: [], dinner: [] });
  const loose: DietTask[] = [];
  for (const dish of dishes) {
    const days = dishDays(dish);
    if (!days.length) loose.push(dish);
    for (const day of days) grid.get(day)?.[mealOf(dish)].push(dish);
  }
  return { grid, loose };
}

/** Os pratos de hoje, na ordem das refeições. */
export function todaysMeals(tasks: DietTask[], today: IsoDate) {
  const day = weekdayOf(today);
  const { grid } = weekGrid(tasks);
  const meals = grid.get(day);
  return meals ? MEALS.flatMap((meal) => meals[meal].map((dish) => ({ meal, dish }))) : [];
}

/** Ingredientes digitados (um por linha, aceita "- " ou "• " no começo). */
export function ingredientList(text: string) {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 50);
}
