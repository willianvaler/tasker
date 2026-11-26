import { z } from 'zod';

/**
 * Rodízio de tarefas (CS2, D381). A vez e a ordem são do servidor (`task_rotations`, gravadas só por
 * `set_task_rotation`/`rotation_pass`); aqui só o formato do estado e a ordem para mostrar.
 */
export const ROTATION_MAX = 20;

const stateSchema = z.object({
  members: z.array(z.string()),
  mode: z.enum(['turn', 'week']),
  current_index: z.number().int().min(0),
  counts: z.array(z.object({ user_id: z.string(), total: z.number(), week: z.number() })),
});
export type RotationState = z.infer<typeof stateSchema>;
export type RotationMode = RotationState['mode'];

/** Estado vindo da RPC `task_rotation_state` (null: sem rodízio ou sem acesso). */
export function readRotation(raw: unknown): RotationState | null {
  const parsed = stateSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** A ordem a partir de quem está na vez (a primeira é a da vez). */
export function rotationQueue(members: readonly string[], current: number): string[] {
  const n = members.length;
  if (n === 0) return [];
  const start = ((current % n) + n) % n;
  return [...members.slice(start), ...members.slice(0, start)];
}

/** Sobe (-1) ou desce (+1) uma pessoa na ordem que está sendo montada. */
export function moveInOrder(members: readonly string[], index: number, dir: -1 | 1): string[] {
  const to = index + dir;
  if (index < 0 || index >= members.length || to < 0 || to >= members.length) return [...members];
  const next = [...members];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/** Quanto cada pessoa fez (total e nesta semana); quem nunca fez aparece com zero. */
export function rotationCounts(
  state: RotationState,
): { userId: string; total: number; week: number }[] {
  return state.members.map((userId) => {
    const c = state.counts.find((x) => x.user_id === userId);
    return { userId, total: c?.total ?? 0, week: c?.week ?? 0 };
  });
}
