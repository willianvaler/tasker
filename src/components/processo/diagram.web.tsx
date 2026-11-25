import '@xyflow/react/dist/style.css';

import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { NO_H, NO_W } from '@/lib/processo/layout';
import type { Grafo } from '@/lib/processo';
import { useColors } from '@/lib/tokens';

// Diagrama do processo na web (PR5, D354): React Flow, editável no editor e só leitura na
// instância (com o passo atual em destaque). No celular, `diagram.tsx` mostra a lista.

type DadosNo = { nome: string; tipo: string; ativo: boolean; erro: boolean; selecionado: boolean };

function NoProcesso({ data }: NodeProps<Node<DadosNo>>) {
  const { t } = useTranslation();
  return (
    <View
      style={{ width: NO_W, height: NO_H }}
      className={cn(
        'justify-center gap-1 rounded border bg-surface px-3',
        data.erro ? 'border-danger' : 'border-line',
        data.ativo && 'border-2 border-accent',
        data.selecionado && 'bg-accent-soft',
      )}
    >
      {data.tipo !== 'inicio' && <Handle type="target" position={Position.Left} />}
      <Text className="text-xs text-ink-muted">
        {t(`processos.no.${data.tipo}` as 'processos.badge')}
      </Text>
      <Text className="text-sm text-ink" numberOfLines={1}>
        {data.nome}
      </Text>
      {data.tipo !== 'fim' && <Handle type="source" position={Position.Right} />}
    </View>
  );
}

const TIPOS = { processo: NoProcesso };

export type DiagramaProps = {
  grafo: Grafo;
  editavel?: boolean;
  /** Nós com token vivo (instância) */
  ativos?: Set<string>;
  /** Nós com erro de validação */
  comErro?: Set<string>;
  selecionado?: { tipo: 'no' | 'aresta'; id: string } | null;
  onSelecionar?: (s: { tipo: 'no' | 'aresta'; id: string } | null) => void;
  onMudar?: (g: Grafo) => void;
  altura?: number;
};

export function Diagrama({
  grafo,
  editavel,
  ativos,
  comErro,
  selecionado,
  onSelecionar,
  onMudar,
  altura = 520,
}: DiagramaProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const { colorScheme } = useColorScheme();
  const nodes: Node<DadosNo>[] = grafo.nos.map((n, i) => ({
    id: n.id,
    type: 'processo',
    position: { x: n.x ?? i * (NO_W + 40), y: n.y ?? 0 },
    data: {
      nome: n.nome || t(`processos.no.${n.tipo}` as 'processos.badge'),
      tipo: n.tipo,
      ativo: !!ativos?.has(n.id),
      erro: !!comErro?.has(n.id),
      selecionado: selecionado?.tipo === 'no' && selecionado.id === n.id,
    },
    draggable: !!editavel,
  }));
  const rotulo = (a: Grafo['arestas'][number]) =>
    a.padrao
      ? t('processos.aresta.padrao')
      : a.erro
        ? t('processos.aresta.erro')
        : a.prazo
          ? t('processos.aresta.prazo')
          : a.escolha
            ? a.escolha
            : a.laco
              ? t(`processos.aresta.${a.laco}` as 'processos.badge')
              : (a.condicao ?? '');
  const edges: Edge[] = grafo.arestas.map((a) => ({
    id: a.id,
    source: a.de,
    target: a.para,
    label: rotulo(a) || undefined,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: {
      stroke: a.erro ? colors.danger : colors['ink-muted'],
      strokeWidth: selecionado?.id === a.id ? 3 : 1.5,
    },
  }));
  const conectar = (c: Connection) => {
    if (!c.source || !c.target || !onMudar) return;
    onMudar({
      ...grafo,
      arestas: [
        ...grafo.arestas,
        { id: `a${Date.now().toString(36)}`, de: c.source, para: c.target },
      ],
    });
  };
  return (
    <View
      style={{ height: altura }}
      className="overflow-hidden rounded-lg border border-line"
      accessibilityLabel={t('processos.diagram')}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={TIPOS}
        fitView
        colorMode={colorScheme === 'dark' ? 'dark' : 'light'}
        nodesConnectable={!!editavel}
        nodesDraggable={!!editavel}
        elementsSelectable
        onConnect={editavel ? conectar : undefined}
        onNodeClick={(_e, n) => onSelecionar?.({ tipo: 'no', id: n.id })}
        onEdgeClick={(_e, e) => onSelecionar?.({ tipo: 'aresta', id: e.id })}
        onPaneClick={() => onSelecionar?.(null)}
        onNodeDragStop={(_e, n) =>
          onMudar?.({
            ...grafo,
            nos: grafo.nos.map((x) =>
              x.id === n.id
                ? { ...x, x: Math.round(n.position.x), y: Math.round(n.position.y) }
                : x,
            ),
          })
        }
        proOptions={{ hideAttribution: true }}
      >
        <Background color={colors.line} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </View>
  );
}
