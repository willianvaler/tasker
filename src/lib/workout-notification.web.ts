// Na web não há tela de bloqueio: nada a mostrar (X1)
export type WorkoutAction = 'done' | 'skip_rest' | 'plus30';
export async function showWorkoutNotification(_content: {
  title: string;
  body: string;
  resting: boolean;
}) {}
export async function clearWorkoutNotification() {}
export function onWorkoutAction(_handler: (action: WorkoutAction) => void) {
  return () => {};
}
