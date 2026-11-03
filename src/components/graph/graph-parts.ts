import { useOpenLink } from '@/components/note-links';
import { forceLayout, type Graph, type GraphKind, type GraphNode, type Point } from '@/lib/graph';
import type { ColorToken } from '@/lib/tokens';

// Peças do grafo (OB9) usadas pela tela /grafo e pelo grafo local da anotação.

/** Cor de cada tipo de ponto (tokens do tema, valem no claro e no escuro) */
export const KIND_COLOR: Record<GraphKind, ColorToken> = {
  note: 'accent',
  task: 'ok',
  page: 'rarity-rare',
  folder: 'rarity-epic',
  ghost: 'ink-muted',
};

/** Abre o item do ponto; o fantasma abre (ou cria) a anotação com o título, como o [[link]] */
export function useOpenNode() {
  const open = useOpenLink();
  return (node: GraphNode) =>
    open(
      node.kind === 'ghost'
        ? { kind: 'new', title: node.title, anchor: null }
        : { kind: node.kind, id: node.id, anchor: null },
    );
}

// O layout é a parte cara (O(n²) por passo): guarda os últimos pelo desenho do grafo, para não
// refazer a cada render nem ao voltar para a tela
const layouts = new Map<string, Map<string, Point>>();

export function cachedLayout(graph: Graph): Map<string, Point> {
  const sig = `${graph.nodes.map((n) => n.key).join(',')}|${graph.edges.map((e) => e.key).join(',')}`;
  const hit = layouts.get(sig);
  if (hit) return hit;
  const positions = forceLayout(graph);
  layouts.set(sig, positions);
  if (layouts.size > 8) layouts.delete(layouts.keys().next().value!);
  return positions;
}
