// Posições do grafo do Fluxo: o dagre arruma da esquerda para a direita; com raias, cada pessoa
// ganha uma faixa e as tarefas da mesma etapa empilham dentro dela.
import { graphlib, layout } from '@dagrejs/dagre';

import { laneOrder, type FlowEdge, type FlowNode } from './flow-graph';

export const NODE_W = 220;
export const NODE_H = 64;
const GAP_Y = 24;
const LANE_PAD = 32;

export type Positioned = { id: string; x: number; y: number };
export type Lane = { name: string; y: number; height: number };

export function layoutFlow(
  nodes: readonly FlowNode[],
  edges: readonly FlowEdge[],
  { lanes = false, myName }: { lanes?: boolean; myName?: string } = {},
): { positions: Map<string, Positioned>; lanes: Lane[] } {
  const g = new graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: GAP_Y, ranksep: 72, marginx: 16, marginy: 16 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const e of edges) g.setEdge(e.source, e.target);
  layout(g);

  const positions = new Map<string, Positioned>();
  for (const n of nodes) {
    const p = g.node(n.id);
    // O dagre devolve o centro; o React Flow quer o canto
    positions.set(n.id, { id: n.id, x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 });
  }
  if (!lanes) return { positions, lanes: [] };

  // Raias: mantém a coluna (x) do dagre; a altura sai da faixa da pessoa
  const result: Lane[] = [];
  let top = 0;
  for (const name of laneOrder(nodes, myName)) {
    const mine = nodes
      .filter((n) => n.lane === name)
      .sort((a, b) => positions.get(a.id)!.y - positions.get(b.id)!.y);
    const slots = new Map<number, number>();
    for (const n of mine) {
      const p = positions.get(n.id)!;
      const slot = slots.get(p.x) ?? 0;
      slots.set(p.x, slot + 1);
      positions.set(n.id, { ...p, y: top + LANE_PAD + slot * (NODE_H + GAP_Y) });
    }
    const rows = Math.max(1, ...slots.values());
    const height = LANE_PAD * 2 + rows * NODE_H + (rows - 1) * GAP_Y;
    result.push({ name, y: top, height });
    top += height;
  }
  return { positions, lanes: result };
}
