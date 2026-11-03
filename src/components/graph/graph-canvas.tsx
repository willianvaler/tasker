import { Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { SvgGraph } from '@/components/graph/svg-graph';
import { IconButton } from '@/components/ui/button';
import type { Graph, GraphNode, Point } from '@/lib/graph';

/**
 * O grafo no celular (OB9): o desenho em SVG, que rola nos dois sentidos, com zoom pelos botões.
 * Na web é o React Flow (graph-canvas.web.tsx).
 */
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
  const { width } = useWindowDimensions();
  const [zoom, setZoom] = useState(1);
  return (
    <View
      testID="graph-canvas"
      style={{ height }}
      className="overflow-hidden rounded border border-line bg-paper"
    >
      <ScrollView horizontal>
        <ScrollView>
          <SvgGraph
            graph={graph}
            positions={positions}
            width={width - 32}
            height={height}
            zoom={zoom}
            focus={focus}
            onOpen={onOpen}
          />
        </ScrollView>
      </ScrollView>
      <View className="absolute bottom-2 right-2 flex-row gap-1 rounded border border-line bg-surface">
        <IconButton
          icon={Minus}
          label={t('graph.zoomOut')}
          onPress={() => setZoom(Math.max(0.5, zoom / 1.4))}
        />
        <IconButton
          icon={Plus}
          label={t('graph.zoomIn')}
          onPress={() => setZoom(Math.min(4, zoom * 1.4))}
        />
      </View>
    </View>
  );
}
