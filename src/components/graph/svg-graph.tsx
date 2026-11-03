import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';

import { KIND_COLOR } from '@/components/graph/graph-parts';
import { bounds, nodeRadius, type Graph, type GraphNode, type Point } from '@/lib/graph';
import { useColors } from '@/lib/tokens';

/**
 * O grafo desenhado em SVG (OB9): cabe na caixa `width` × `height` (× `zoom`). Serve ao grafo local
 * da anotação e ao grafo do celular (o da web larga é o React Flow). Tocar no ponto abre o item.
 */
export function SvgGraph({
  graph,
  positions,
  width,
  height,
  zoom = 1,
  focus,
  labels = true,
  onOpen,
}: {
  graph: Graph;
  positions: Map<string, Point>;
  width: number;
  height: number;
  zoom?: number;
  focus?: string | null;
  labels?: boolean;
  onOpen: (node: GraphNode) => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const box = bounds(positions.values());
  const pad = 40;
  const w = Math.max(1, box.maxX - box.minX);
  const h = Math.max(1, box.maxY - box.minY);
  const scale = Math.min((width - pad * 2) / w, (height - pad * 2) / h, 1.6) * zoom;
  const W = Math.max(width, w * scale + pad * 2);
  const H = Math.max(height, h * scale + pad * 2);
  const at = (key: string) => {
    const p = positions.get(key) ?? { x: 0, y: 0 };
    return {
      x: (p.x - box.minX) * scale + (W - w * scale) / 2,
      y: (p.y - box.minY) * scale + (H - h * scale) / 2,
    };
  };
  return (
    <View style={{ width: W, height: H }}>
      <Svg width={W} height={H} accessibilityLabel={t('graph.title')}>
        {graph.edges.map((e) => {
          const a = at(e.source);
          const b = at(e.target);
          const hot = focus && (e.source === focus || e.target === focus);
          return (
            <Line
              key={e.key}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={hot ? colors.accent : colors.line}
              strokeWidth={hot ? 1.6 : 1}
            />
          );
        })}
        {graph.nodes.map((n) => {
          const p = at(n.key);
          const r = nodeRadius(n.degree) * Math.min(1.2, Math.max(0.7, scale));
          const color = colors[KIND_COLOR[n.kind]];
          const title = n.title || t('notes.untitled');
          return (
            <G
              key={n.key}
              onPress={() => onOpen(n)}
              accessibilityRole="link"
              accessibilityLabel={title}
            >
              <Circle
                cx={p.x}
                cy={p.y}
                r={n.key === focus ? r + 3 : r}
                fill={n.kind === 'ghost' ? colors.surface : color}
                stroke={n.key === focus ? colors.ink : color}
                strokeWidth={n.key === focus ? 2 : 1}
                strokeDasharray={n.kind === 'ghost' ? '3 2' : undefined}
              />
              {labels && (
                <SvgText
                  x={p.x}
                  y={p.y + r + 12}
                  fontSize={11}
                  fill={n.key === focus ? colors.ink : colors['ink-muted']}
                  textAnchor="middle"
                >
                  {title.length > 28 ? `${title.slice(0, 27)}…` : title}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}
