/**
 * Nova posição para um item arrastado de `from` para `to` numa lista ordenada por posição.
 * Fica no meio dos vizinhos do destino (posições são números reais), então só o item movido muda.
 */
export function positionAfterMove(positions: number[], from: number, to: number): number {
  if (from === to) return positions[from];
  const rest = positions.filter((_, i) => i !== from);
  const prev = rest[to - 1];
  const next = rest[to];
  if (prev !== undefined && next !== undefined) return (prev + next) / 2;
  if (prev !== undefined) return prev + 1;
  if (next !== undefined) return next - 1;
  return positions[from];
}
