import '@xyflow/react/dist/style.css';

import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View } from 'react-native';

import { openTask, StateMark, useNodeText } from '@/components/project/flow-parts';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import type { FlowGraph, FlowNode } from '@/lib/flow-graph';
import { layoutFlow, NODE_H, NODE_W } from '@/lib/flow-layout';
import { useDependencyMutations } from '@/lib/queries/dependencies';
import { useColors } from '@/lib/tokens';
import { useToast } from '@/providers/toast';

type TaskData = { node: FlowNode; canLink: boolean; turn: string };
type LaneData = { name: string; width: number; height: number };

function TaskNode({ data }: NodeProps<Node<TaskData>>) {
  const { node, canLink, turn } = data;
  return (
    <View
      style={{ width: NODE_W, height: NODE_H }}
      className={cn(
        'justify-center gap-1 rounded border bg-surface px-3',
        node.state === 'blocked' ? 'border-dashed border-line' : 'border-line',
        node.frontier && 'border-2 border-ok',
        node.state === 'doing' && 'border-2 border-accent',
        node.critical && node.state !== 'done' && 'border-l-4 border-l-accent',
        node.state === 'done' && 'opacity-60',
      )}
    >
      <Handle type="target" position={Position.Left} isConnectable={canLink} />
      <View className="flex-row items-center gap-2">
        <StateMark state={node.state} />
        <Text
          className={cn(
            'flex-1 text-sm text-ink',
            node.state === 'done' && 'text-ink-muted line-through',
            node.critical && 'font-semibold',
          )}
          numberOfLines={1}
        >
          {node.title}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-xs text-ink-muted" numberOfLines={1}>
          {node.people.map((p) => p.name).join(', ')}
        </Text>
        {node.mine && (
          <Text className="rounded bg-accent-soft px-1 text-xs font-semibold text-accent">
            {turn}
          </Text>
        )}
      </View>
      <Handle type="source" position={Position.Right} isConnectable={canLink} />
    </View>
  );
}

function LaneNode({ data }: NodeProps<Node<LaneData>>) {
  return (
    <View
      style={{ width: data.width, height: data.height }}
      className="border-b border-line bg-wash/40"
      pointerEvents="none"
    >
      <Text className="px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {data.name}
      </Text>
    </View>
  );
}

const NODE_TYPES = { task: TaskNode, lane: LaneNode };

/** O grafo do Fluxo (React Flow + dagre, D114). */
export function FlowCanvas({
  rootId,
  graph,
  lanes,
  myName,
  titleOf,
  canLink,
}: {
  rootId: string;
  graph: FlowGraph;
  lanes: boolean;
  myName?: string;
  titleOf: (id: string) => string | undefined;
  canLink: boolean;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const colors = useColors();
  const { height } = useWindowDimensions();
  const toast = useToast();
  const mutations = useDependencyMutations(rootId);
  const text = useNodeText();

  const layout = layoutFlow(graph.nodes, graph.edges, { lanes, myName });
  const right = Math.max(0, ...[...layout.positions.values()].map((p) => p.x)) + NODE_W + 48;
  const nodes: Node[] = [
    ...layout.lanes.map((lane) => ({
      id: `lane:${lane.name}`,
      type: 'lane',
      position: { x: -24, y: lane.y },
      data: { name: lane.name || t('people.unassigned'), width: right + 24, height: lane.height },
      selectable: false,
      draggable: false,
      connectable: false,
      focusable: false,
      zIndex: -1,
    })),
    ...graph.nodes.map((node) => ({
      id: node.id,
      type: 'task',
      position: layout.positions.get(node.id) ?? { x: 0, y: 0 },
      data: { node, canLink, turn: t('flowView.yourTurn') },
      ariaLabel: text(node, titleOf),
      draggable: false,
      connectable: canLink,
    })),
  ];
  const edges: Edge[] = graph.edges.map((e) => {
    const stroke = e.critical ? colors.accent : e.met ? colors.ok : colors['ink-muted'];
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.lag ? t('flow.lagShort', { minutes: e.lag }) : undefined,
      animated: !e.met && graph.nodes.some((n) => n.id === e.source && n.frontier),
      style: {
        stroke,
        strokeWidth: e.critical ? 2.5 : 1.5,
        strokeDasharray: e.met ? undefined : '5 4',
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
      labelStyle: { fill: colors['ink-muted'], fontSize: 12 },
      labelBgStyle: { fill: colors.paper },
      focusable: false,
    };
  });
  // Começa em "você está aqui": em grafo grande, a fronteira ativa e os vizinhos; senão, tudo
  const near = new Set(graph.nodes.filter((n) => n.frontier).map((n) => n.id));
  for (const e of graph.edges)
    if (near.has(e.source) || near.has(e.target)) near.add(e.source).add(e.target);
  const focus = graph.nodes.length > 15 && near.size ? [...near].map((id) => ({ id })) : undefined;

  function connect(c: Connection) {
    if (!c.source || !c.target || c.source === c.target) return;
    // Da tarefa de origem para a de destino: o destino passa a depender da origem
    mutations.add.mutate(
      { taskId: c.target, dependsOn: c.source },
      { onError: (err) => toast({ message: err.message }) },
    );
  }

  return (
    <View
      style={{ height: Math.max(420, height - 300) }}
      className="overflow-hidden rounded border border-line"
      accessibilityLabel={t('flowView.graph')}
    >
      <ReactFlow
        // Recalcula o enquadramento quando muda o modo de raias
        key={lanes ? 'lanes' : 'free'}
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        colorMode={colorScheme === 'dark' ? 'dark' : 'light'}
        fitView
        fitViewOptions={{
          nodes: focus,
          maxZoom: 1,
          padding: 0.3,
        }}
        minZoom={0.2}
        nodesDraggable={false}
        nodesConnectable={canLink}
        elementsSelectable
        onConnect={connect}
        onNodeClick={(_, node) => node.type === 'task' && openTask(node.id)}
        onKeyDown={(e) => {
          // Enter no nó focado (Tab percorre os nós) abre a tarefa
          const id = (e.target as HTMLElement)
            .closest?.('.react-flow__node')
            ?.getAttribute('data-id');
          if (e.key === 'Enter' && id && !id.startsWith('lane:')) openTask(id);
        }}
        style={{ background: colors.paper }}
      >
        <Background color={colors.line} gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </View>
  );
}
