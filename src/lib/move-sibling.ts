import { positionAfterMove } from './positions';

/**
 * "Mover para cima / para baixo" de pastas e páginas (V6 §15.2), sem arrastar: a nova posição do
 * item `id` trocado com o vizinho, ou null quando não há para onde ir (ponta da lista, id ausente).
 */
export function moveSibling(
  siblings: readonly { id: string; position: number }[],
  id: string,
  dir: -1 | 1,
): number | null {
  // sort é estável: empates ficam na ordem recebida
  const sorted = [...siblings].sort((a, b) => a.position - b.position);
  const from = sorted.findIndex((s) => s.id === id);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= sorted.length) return null;
  return positionAfterMove(
    sorted.map((s) => s.position),
    from,
    to,
  );
}
