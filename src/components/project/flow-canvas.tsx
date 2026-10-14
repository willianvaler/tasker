import type { FlowGraph } from '@/lib/flow-graph';

/** No app nativo o Fluxo é só a lista (o grafo do React Flow é da web). */
export function FlowCanvas(_props: {
  rootId: string;
  graph: FlowGraph;
  lanes: boolean;
  myName?: string;
  titleOf: (id: string) => string | undefined;
  canLink: boolean;
}) {
  return null;
}
