// Na web não há tela de bloqueio: nada a mostrar (X1)
import type { WorkoutLockContent } from './workout-notification';

export type { WorkoutLockContent };
export type WorkoutAction = 'done' | 'skip_rest' | 'plus30';
export async function showWorkoutNotification(_content: WorkoutLockContent) {}
export async function clearWorkoutNotification() {}
export function onWorkoutAction(_handler: (action: WorkoutAction) => void) {
  return () => {};
}
