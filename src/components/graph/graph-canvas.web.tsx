import '@xyflow/react/dist/style.css';

import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { KIND_COLOR } from '@/components/graph/graph-parts';
import { Text } from '@/components/ui/text';
import { nodeRadius, type Graph, type GraphNode, type Point } from '@/lib/graph';
import { useColors } from '@/lib/tokens';

type DotData = { node: GraphNode; focus: boolean; title: string };

/** Ponto do grafo: bolinha (maior quanto mais citado) e o nome embaixo */
function DotNode({ data }: NodeProps<Node<DotData>>) {
  const colors = useColors();
  const { node, focus, title } = data;
  const r = nodeRadius(node.degree);
  const color = colors[KIND_COLOR[node.kind]];
  return (
    <View style={{ width: 120, alignItems: 'center' }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, top: r }} />
      <View
        style={{
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          backgroundColor: node.kind === 'ghost' ? colors.surface : color,
          borderColor: focus ? colors.ink : color,
          borderWidth: focus ? 2 : 1,
          borderStyle: node.kind === 'ghost' ? 'dashed' : 'solid',
        }}
      />
      <Text numberOfLines={2} className="mt-1 text-center text-xs text-ink-muted">
        {title}
      </Text>
      <Handle type="source" position={Position.Top} style={{ opacity: 0, top: r }} />
    </View>
  );
}

const NODE_TYPES = { dot: DotNode };

/** O grafo na web (React Flow): zoom, arrastar a tela e os pontos; clicar abre o item */
export function GraphCanvas({
  graph,
  positions,
  focus,
  height,
  onOpen,
}: {
  graph: Graph;
  positions: Map<string, Point>;
  focus: string | null;
  height: number;
  onOpen: (node: GraphNode) => void;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const colors = useColors();
  const byKey = new Map(graph.nodes.map((n) => [n.key, n]));
  const nodes: Node<DotData>[] = graph.nodes.map((n) => {
    const p = positions.get(n.key) ?? { x: 0, y: 0 };
    return {
      id: n.key,
      type: 'dot',
      position: { x: p.x * 1.4 - 60, y: p.y * 1.4 - nodeRadius(n.degree) },
      data: { node: n, focus: n.key === focus, title: n.title || t('notes.untitled') },
      ariaLabel: n.title || t('notes.untitled'),
      connectable: false,
    };
  });
  const edges: Edge[] = graph.edges.map((e) => {
    const hot = !!focus && (e.source === focus || e.target === focus);
    return {
      id: e.key,
      source: e.source,
      target: e.target,
      type: 'straight',
      style: {
        stroke: hot ? colors.accent : colors['ink-muted'],
        strokeWidth: hot ? 1.6 : 0.8,
        opacity: hot ? 1 : 0.6,
      },
      focusable: false,
    };
  });
  return (
    <View
      testID="graph-canvas"
      style={{ height }}
      className="overflow-hidden rounded border border-line"
      accessibilityLabel={t('graph.title')}
    >
      <ReactFlow
        key={`${graph.nodes.length}:${focus ?? ''}`}
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        colorMode={colorScheme === 'dark' ? 'dark' : 'light'}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
        minZoom={0.05}
        nodesConnectable={false}
        onNodeClick={(_, node) => {
          const n = byKey.get(node.id);
          if (n) onOpen(n);
        }}
        onKeyDown={(e) => {
          const id = (e.target as HTMLElement)
            .closest?.('.react-flow__node')
            ?.getAttribute('data-id');
          const n = id ? byKey.get(id) : undefined;
          if (e.key === 'Enter' && n) onOpen(n);
        }}
        style={{ background: colors.paper }}
      >
        <Background color={colors.line} gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </View>
  );
}
