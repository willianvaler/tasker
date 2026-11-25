// Disposição automática do diagrama do processo (PR5): o dagre arruma da esquerda para a direita.
import { graphlib, layout } from '@dagrejs/dagre';

import type { Grafo } from '../../../supabase/functions/_shared/processo';

export const NO_W = 180;
export const NO_H = 56;

export function disporGrafo(g: Grafo): Grafo {
  const dg = new graphlib.Graph();
  dg.setGraph({ rankdir: 'LR', nodesep: 32, ranksep: 64, marginx: 16, marginy: 16 });
  dg.setDefaultEdgeLabel(() => ({}));
  for (const n of g.nos) dg.setNode(n.id, { width: NO_W, height: NO_H });
  for (const a of g.arestas)
    if (g.nos.some((n) => n.id === a.de) && g.nos.some((n) => n.id === a.para))
      dg.setEdge(a.de, a.para);
  layout(dg);
  return {
    ...g,
    nos: g.nos.map((n) => {
      const p = dg.node(n.id);
      return p ? { ...n, x: Math.round(p.x - NO_W / 2), y: Math.round(p.y - NO_H / 2) } : n;
    }),
  };
}
