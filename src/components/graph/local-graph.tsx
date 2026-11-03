import { router } from 'expo-router';
import { Waypoints } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { cachedLayout, useOpenNode } from '@/components/graph/graph-parts';
import { SvgGraph } from '@/components/graph/svg-graph';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/section-label';
import { filterGraph, nodeKey } from '@/lib/graph';
import { useGraph } from '@/lib/queries/graph';
import type { LinkKind } from '@/lib/wikilinks';

/** Grafo local (OB9): o item e os vizinhos até 2 passos; some quando não há ligação */
export function LocalGraph({ kind, id }: { kind: LinkKind; id: string }) {
  const { t } = useTranslation();
  const data = useGraph();
  const openNode = useOpenNode();
  const [width, setWidth] = useState(0);
  const focus = nodeKey(kind, id);
  if (!data.graph) return null;
  const graph = filterGraph(data.graph, {
    kinds: ['note', 'task', 'page', 'folder', 'ghost'],
    orphans: false,
    focus,
    depth: 2,
  });
  if (graph.edges.length === 0) return null;
  const positions = cachedLayout(graph);
  return (
    <View className="gap-2 pt-4" testID="local-graph">
      <SectionLabel
        title={t('graph.local')}
        count={graph.nodes.length - 1}
        right={
          <Button
            variant="ghost"
            icon={Waypoints}
            label={t('graph.openFull')}
            onPress={() => router.push({ pathname: '/grafo', params: { foco: focus } })}
          />
        }
      />
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        className="overflow-hidden rounded border border-line bg-paper"
        style={{ height: 240 }}
      >
        {width > 0 && (
          <SvgGraph
            graph={graph}
            positions={positions}
            width={width}
            height={240}
            focus={focus}
            onOpen={(node) => node.key !== focus && openNode(node)}
          />
        )}
      </View>
    </View>
  );
}
