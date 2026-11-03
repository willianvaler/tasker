import '@xyflow/react/dist/style.css';

import {
  Background,
  ConnectionMode,
  Controls,
  Handle,
  MarkerType,
  NodeResizer,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
} from '@xyflow/react';
import * as DocumentPicker from 'expo-document-picker';
import { Download, Group, Link2, StickyNote, Trash2, Type, Upload } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, useWindowDimensions, View } from 'react-native';

import {
  CardPicker,
  COLOR_TOKEN,
  LinkCard,
  RefCard,
  useCanvasState,
  useCardTitles,
} from '@/components/canvas/canvas-parts';
import { Button } from '@/components/ui/button';
import { PromptDialog } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import {
  addEdge,
  addNode,
  CANVAS_COLORS,
  cardFile,
  cardRef,
  exportCanvas,
  importCanvas,
  isWebUrl,
  mergeCanvas,
  NODE_SIZE,
  placeNew,
  removeEdges,
  removeNodes,
  updateEdge,
  updateNode,
  type CanvasColor,
  type CanvasNode,
  type CanvasSide,
} from '@/lib/canvas';
import { saveTextFile } from '@/lib/download';
import { useLinkTitles } from '@/lib/queries/links';
import { noteTitle, useNotes } from '@/lib/queries/notes';
import type { Page } from '@/lib/queries/tree';
import { useColors } from '@/lib/tokens';
import { uuidv7 } from '@/lib/uuid';
import { useToast } from '@/providers/toast';

// Canvas na web (OB10, ESCOPO_V11 §6, D295): o quadro branco infinito com React Flow. Arrastar e
// redimensionar os cartões, puxar setas entre eles (rótulo com dois cliques), grupos coloridos,
// texto solto, endereço/imagem e cartões de verdade (a tarefa marca de verdade).

type CardData = {
  node: CanvasNode;
  manage: boolean;
  editing: boolean;
  onText: (text: string) => void;
  onEditEnd: () => void;
};

const SIDES: { side: CanvasSide; position: Position }[] = [
  { side: 'top', position: Position.Top },
  { side: 'right', position: Position.Right },
  { side: 'bottom', position: Position.Bottom },
  { side: 'left', position: Position.Left },
];

function Handles({ manage }: { manage: boolean }) {
  return (
    <>
      {SIDES.map((s) => (
        <Handle
          key={s.side}
          id={s.side}
          type="source"
          position={s.position}
          isConnectable={manage}
          style={{ opacity: manage ? 1 : 0 }}
        />
      ))}
    </>
  );
}

function useTone(color: CanvasColor | undefined) {
  const colors = useColors();
  return color ? colors[COLOR_TOKEN[color]] : colors.line;
}

function CardNode({ data, selected }: NodeProps<Node<CardData>>) {
  const { node, manage, editing } = data;
  const border = useTone(node.color);
  const colors = useColors();
  const ref = cardRef(node);
  return (
    <View
      style={{
        width: '100%',
        height: '100%',
        borderColor: selected ? colors.accent : border,
        borderWidth: node.color || selected ? 2 : 1,
      }}
      className="overflow-hidden rounded-lg bg-surface"
    >
      <NodeResizer isVisible={manage && selected} minWidth={80} minHeight={40} />
      <Handles manage={manage} />
      {ref ? (
        <RefCard kind={ref.kind} id={ref.id} />
      ) : node.type === 'link' ? (
        <LinkCard url={node.url ?? ''} />
      ) : node.type === 'file' ? (
        <Text className="p-3 text-sm text-ink-muted">{node.file}</Text>
      ) : editing ? (
        <TextInput
          autoFocus
          multiline
          defaultValue={node.text ?? ''}
          onChangeText={data.onText}
          onBlur={data.onEditEnd}
          className="nodrag nowheel h-full w-full p-3 font-sans text-sm text-ink"
          style={{ outlineStyle: 'none' } as object}
        />
      ) : (
        <Text className="p-3 text-sm text-ink">{node.text}</Text>
      )}
    </View>
  );
}

function GroupNode({ data, selected }: NodeProps<Node<CardData>>) {
  const { node, manage } = data;
  const tone = useTone(node.color);
  const colors = useColors();
  return (
    <View
      style={{
        width: '100%',
        height: '100%',
        borderColor: selected ? colors.accent : tone,
        borderWidth: 2,
        // A cor do grupo bem clara no fundo (hex do tema + transparência)
        backgroundColor: `${tone}1A`,
      }}
      className="rounded-lg"
    >
      <NodeResizer isVisible={manage && selected} minWidth={120} minHeight={80} />
      <Handles manage={manage} />
      <Text className="px-3 py-1 text-sm font-semibold text-ink">{node.label}</Text>
    </View>
  );
}

const NODE_TYPES = { card: CardNode, group: GroupNode };

type Dialog =
  | { kind: 'card' }
  | { kind: 'url' }
  | { kind: 'group' }
  | { kind: 'label'; groupId: string }
  | { kind: 'edge'; edgeId: string };

export function CanvasView({ page }: { page: Page }) {
  const { t } = useTranslation();
  const toast = useToast();
  const colors = useColors();
  const { colorScheme } = useColorScheme();
  const { height } = useWindowDimensions();
  const notes = useNotes();
  const { canvas, change, manage } = useCanvasState(page);
  const titleOfCard = useCardTitles();
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const refs = canvas.nodes.flatMap((n) => {
    const ref = cardRef(n);
    return ref ? [ref] : [];
  });
  const linkTitle = useLinkTitles(refs);

  const add = (node: Omit<CanvasNode, 'id' | 'x' | 'y'>) => {
    const at = placeNew(canvas, node);
    const id = uuidv7();
    change(addNode(canvas, { ...node, id, ...at } as CanvasNode), true);
    setSelected([id]);
    return id;
  };

  const nodes: Node<CardData>[] = canvas.nodes.map((n) => ({
    id: n.id,
    type: n.type === 'group' ? 'group' : 'card',
    position: { x: n.x, y: n.y },
    width: n.width,
    height: n.height,
    selected: selected.includes(n.id),
    zIndex: n.type === 'group' ? -1 : 0,
    ariaLabel:
      n.type === 'group' ? (n.label ?? t('canvas.group')) : titleOfCard(n) || t('canvas.card'),
    data: {
      node: n,
      manage,
      editing: editing === n.id,
      onText: (text) => change(updateNode(canvas, n.id, { text })),
      onEditEnd: () => setEditing(null),
    },
  }));
  const edges: Edge[] = canvas.edges.map((e) => {
    const stroke = e.color ? colors[COLOR_TOKEN[e.color]] : colors['ink-muted'];
    return {
      id: e.id,
      source: e.fromNode,
      target: e.toNode,
      sourceHandle: e.fromSide ?? null,
      targetHandle: e.toSide ?? null,
      label: e.label,
      selected: selectedEdges.includes(e.id),
      style: { stroke, strokeWidth: selectedEdges.includes(e.id) ? 2.5 : 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
      labelStyle: { fill: colors.ink, fontSize: 12 },
      labelBgStyle: { fill: colors.paper },
    };
  });

  function onNodesChange(changes: NodeChange<Node<CardData>>[]) {
    let next = canvas;
    let now = false;
    let sel = selected;
    for (const c of changes) {
      if (c.type === 'position' && c.position && manage) {
        next = updateNode(next, c.id, { x: Math.round(c.position.x), y: Math.round(c.position.y) });
        if (c.dragging === false) now = true;
      } else if (c.type === 'dimensions' && c.dimensions && c.resizing !== undefined && manage) {
        next = updateNode(next, c.id, {
          width: Math.round(c.dimensions.width),
          height: Math.round(c.dimensions.height),
        });
        if (c.resizing === false) now = true;
      } else if (c.type === 'select') {
        sel = c.selected ? [...new Set([...sel, c.id])] : sel.filter((id) => id !== c.id);
      } else if (c.type === 'remove' && manage) {
        next = removeNodes(next, [c.id]);
        now = true;
      }
    }
    if (sel !== selected) setSelected(sel);
    if (next !== canvas) change(next, now);
  }

  function onEdgesChange(changes: EdgeChange[]) {
    let next = canvas;
    let sel = selectedEdges;
    for (const c of changes) {
      if (c.type === 'select')
        sel = c.selected ? [...new Set([...sel, c.id])] : sel.filter((id) => id !== c.id);
      else if (c.type === 'remove' && manage) next = removeEdges(next, [c.id]);
    }
    if (sel !== selectedEdges) setSelectedEdges(sel);
    if (next !== canvas) change(next, true);
  }

  function connect(c: Connection) {
    if (!manage || !c.source || !c.target) return;
    change(
      addEdge(canvas, {
        id: uuidv7(),
        fromNode: c.source,
        toNode: c.target,
        fromSide: (c.sourceHandle as CanvasSide | null) ?? undefined,
        toSide: (c.targetHandle as CanvasSide | null) ?? undefined,
      }),
      true,
    );
  }

  function paint(color: CanvasColor | undefined) {
    let next = canvas;
    for (const id of selected) next = updateNode(next, id, { color });
    for (const id of selectedEdges) next = updateEdge(next, id, { color });
    change(next, true);
  }

  function removeSelected() {
    change(removeEdges(removeNodes(canvas, selected), selectedEdges), true);
    setSelected([]);
    setSelectedEdges([]);
  }

  function exportFile() {
    // Se a tarefa está feita não se sabe aqui sem ler cada uma: sai como texto, sem caixinha
    const json = exportCanvas(canvas, linkTitle, () => undefined);
    void saveTextFile(`${page.name}.canvas`, json, 'application/json');
  }

  async function importFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'] });
    if (result.canceled || !result.assets[0]) return;
    const text = await fetch(result.assets[0].uri).then((r) => r.text());
    const byTitle = (title: string) =>
      notes.data?.find((n) => noteTitle(n, '').toLocaleLowerCase() === title.toLocaleLowerCase())
        ?.id;
    const extra = importCanvas(text, byTitle, `${uuidv7().slice(-8)}-`);
    if (!extra) {
      toast({ message: t('canvas.importError') });
      return;
    }
    change(mergeCanvas(canvas, extra), true);
    toast({ message: t('canvas.imported', { count: extra.nodes.length }) });
  }

  const anySelected = selected.length + selectedEdges.length > 0;
  return (
    <View className="flex-1 gap-2 pb-4">
      <View className="flex-row flex-wrap items-center gap-2">
        {manage && (
          <>
            <Button
              variant="ghost"
              icon={Type}
              label={t('canvas.addText')}
              onPress={() => {
                const id = add({ type: 'text', text: '', ...NODE_SIZE.text });
                setEditing(id);
              }}
            />
            <Button
              variant="ghost"
              icon={StickyNote}
              label={t('canvas.addCard')}
              onPress={() => setDialog({ kind: 'card' })}
            />
            <Button
              variant="ghost"
              icon={Link2}
              label={t('canvas.addUrl')}
              onPress={() => setDialog({ kind: 'url' })}
            />
            <Button
              variant="ghost"
              icon={Group}
              label={t('canvas.addGroup')}
              onPress={() => setDialog({ kind: 'group' })}
            />
            <Button
              variant="ghost"
              icon={Upload}
              label={t('canvas.import')}
              onPress={() => void importFile()}
            />
          </>
        )}
        <Button variant="ghost" icon={Download} label={t('canvas.export')} onPress={exportFile} />
      </View>
      {manage && anySelected && (
        <View
          className="flex-row flex-wrap items-center gap-2"
          accessibilityLabel={t('canvas.selection')}
        >
          <Text className="text-xs text-ink-muted">{t('canvas.color')}</Text>
          {CANVAS_COLORS.map((c) => (
            <ColorDot key={c} color={c} onPress={() => paint(c)} />
          ))}
          <Button variant="ghost" label={t('canvas.noColor')} onPress={() => paint(undefined)} />
          <Button
            variant="ghost"
            icon={Trash2}
            label={t('canvas.remove')}
            onPress={removeSelected}
          />
        </View>
      )}
      <View
        testID="canvas"
        style={{ height: Math.max(460, height - 260) }}
        className="overflow-hidden rounded border border-line"
        accessibilityLabel={t('canvas.title')}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          colorMode={colorScheme === 'dark' ? 'dark' : 'light'}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
          minZoom={0.1}
          nodesDraggable={manage}
          nodesConnectable={manage}
          elementsSelectable
          deleteKeyCode={manage && !editing ? ['Backspace', 'Delete'] : null}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={connect}
          onNodeDoubleClick={(_, node) => {
            if (!manage) return;
            const n = canvas.nodes.find((x) => x.id === node.id);
            if (n?.type === 'text') setEditing(n.id);
            else if (n?.type === 'group') setDialog({ kind: 'label', groupId: n.id });
          }}
          onEdgeDoubleClick={(_, edge) => manage && setDialog({ kind: 'edge', edgeId: edge.id })}
          style={{ background: colors.paper }}
        >
          <Background color={colors.line} gap={24} />
          <Controls showInteractive={false} />
        </ReactFlow>
        {canvas.nodes.length === 0 && (
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center p-6">
            <Text className="text-center text-sm text-ink-muted">
              {manage ? t('canvas.emptyHint') : t('canvas.empty')}
            </Text>
          </View>
        )}
      </View>

      {dialog?.kind === 'card' && (
        <CardPicker
          onClose={() => setDialog(null)}
          onPick={(c) => {
            setDialog(null);
            add({
              type: 'file',
              file: cardFile(c.kind, c.id),
              ...NODE_SIZE.card,
              ...(c.kind === 'note' ? { height: 160 } : {}),
            });
          }}
        />
      )}
      {dialog?.kind === 'url' && (
        <PromptDialog
          title={t('canvas.addUrl')}
          fields={[{ key: 'url', placeholder: 'https://…', maxLength: 2000 }]}
          validate={(v) => isWebUrl(v.url ?? '')}
          onClose={() => setDialog(null)}
          onConfirm={({ url }) => {
            setDialog(null);
            add({ type: 'link', url, ...NODE_SIZE.link });
          }}
        />
      )}
      {dialog?.kind === 'group' && (
        <PromptDialog
          title={t('canvas.addGroup')}
          fields={[{ key: 'label', placeholder: t('canvas.groupName'), maxLength: 200 }]}
          onClose={() => setDialog(null)}
          onConfirm={({ label }) => {
            setDialog(null);
            add({ type: 'group', label, ...NODE_SIZE.group });
          }}
        />
      )}
      {dialog?.kind === 'label' && (
        <PromptDialog
          title={t('canvas.renameGroup')}
          fields={[
            {
              key: 'label',
              placeholder: t('canvas.groupName'),
              initial: canvas.nodes.find((n) => n.id === dialog.groupId)?.label ?? '',
              maxLength: 200,
            },
          ]}
          onClose={() => setDialog(null)}
          onConfirm={({ label }) => {
            change(updateNode(canvas, dialog.groupId, { label }), true);
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === 'edge' && (
        <PromptDialog
          title={t('canvas.edgeLabel')}
          fields={[
            {
              key: 'label',
              placeholder: t('canvas.edgeLabel'),
              initial: canvas.edges.find((e) => e.id === dialog.edgeId)?.label ?? '',
              maxLength: 200,
            },
          ]}
          validate={() => true}
          onClose={() => setDialog(null)}
          onConfirm={({ label }) => {
            change(updateEdge(canvas, dialog.edgeId, { label }), true);
            setDialog(null);
          }}
        />
      )}
    </View>
  );
}

function ColorDot({ color, onPress }: { color: CanvasColor; onPress: () => void }) {
  const { t } = useTranslation();
  const tone = useTone(color);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('canvas.colorN', { n: color })}
      onPress={onPress}
      className="h-8 w-8 items-center justify-center"
    >
      <View className="h-6 w-6 rounded-full border border-line" style={{ backgroundColor: tone }} />
    </Pressable>
  );
}
