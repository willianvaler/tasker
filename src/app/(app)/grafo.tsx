import { useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View } from 'react-native';

import { GraphCanvas } from '@/components/graph/graph-canvas';
import { cachedLayout, useOpenNode } from '@/components/graph/graph-parts';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { filterGraph, type GraphKind } from '@/lib/graph';
import { useGraph } from '@/lib/queries/graph';
import { useTree } from '@/lib/queries/tree';
import { fold } from '@/lib/query/parse';

// Grafo global (OB9, ESCOPO_V11 §6, D294): anotações, tarefas, listas e pastas ligadas pelos
// [[links]], com filtros por tipo, etiqueta, pasta, as soltas e "só o que está ligado a este".
// `?foco=note:<id>` abre já no grafo local de um item.

const KINDS: GraphKind[] = ['note', 'task', 'page', 'folder', 'ghost'];

export default function GraphScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ foco?: string }>();
  const { height } = useWindowDimensions();
  const tree = useTree();
  const data = useGraph();
  const openNode = useOpenNode();
  const [kinds, setKinds] = useState<GraphKind[]>(['note', 'task', 'page', 'folder', 'ghost']);
  const [orphans, setOrphans] = useState(true);
  const [tag, setTag] = useState('');
  const [folder, setFolder] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(params.foco ?? null);
  const [depth, setDepth] = useState(2);
  const [search, setSearch] = useState('');
  const kindLabel: Record<GraphKind, string> = {
    note: t('graph.kind.note'),
    task: t('graph.kind.task'),
    page: t('graph.kind.page'),
    folder: t('graph.kind.folder'),
    ghost: t('graph.kind.ghost'),
  };
  const root = tree.data?.folders.find((f) => f.id === folder);
  const graph = data.graph
    ? filterGraph(data.graph, {
        kinds,
        orphans,
        tag: tag.trim() || null,
        folderIds: root ? [root.id, ...root.children.map((c) => c.id)] : null,
        focus,
        depth,
      })
    : null;
  const positions = graph ? cachedLayout(graph) : null;
  const focused = focus ? data.graph?.nodes.find((n) => n.key === focus) : undefined;
  const term = fold(search.trim());
  const matches =
    term && data.graph
      ? data.graph.nodes.filter((n) => fold(n.title).includes(term)).slice(0, 6)
      : [];

  return (
    <Screen size="wide">
      <ScreenHeader title={t('graph.title')} help="pastas-projetos-paginas" back />
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="gap-3 pb-clear">
        <View className="flex-row flex-wrap items-center gap-2">
          {KINDS.map((k) => (
            <Chip
              key={k}
              role="checkbox"
              label={kindLabel[k]}
              selected={kinds.includes(k)}
              onPress={() =>
                setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k])
              }
            />
          ))}
          <Chip
            role="checkbox"
            label={t('graph.orphans')}
            selected={orphans}
            onPress={() => setOrphans(!orphans)}
          />
        </View>
        <View className="flex-row flex-wrap items-center gap-2">
          <Input
            accessibilityLabel={t('graph.search')}
            placeholder={t('graph.search')}
            value={search}
            onChangeText={setSearch}
            className="min-w-48 flex-1"
          />
          <Input
            accessibilityLabel={t('graph.tag')}
            placeholder={t('graph.tag')}
            value={tag}
            onChangeText={setTag}
            autoCapitalize="none"
            className="w-40"
          />
        </View>
        {matches.length > 0 && (
          <View className="flex-row flex-wrap gap-2" accessibilityLabel={t('graph.results')}>
            {matches.map((n) => (
              <Chip
                key={n.key}
                label={`${n.title || t('notes.untitled')} · ${kindLabel[n.kind]}`}
                onPress={() => {
                  setFocus(n.key);
                  setSearch('');
                }}
              />
            ))}
          </View>
        )}
        {(tree.data?.folders.length ?? 0) > 0 && (
          <View
            className="flex-row flex-wrap gap-2"
            accessibilityRole="radiogroup"
            accessibilityLabel={t('graph.folder')}
          >
            <Chip
              role="radio"
              label={t('graph.allFolders')}
              selected={!folder}
              onPress={() => setFolder(null)}
            />
            {tree.data?.folders
              .filter((f) => !f.is_inbox)
              .map((f) => (
                <Chip
                  key={f.id}
                  role="radio"
                  label={f.name}
                  selected={folder === f.id}
                  onPress={() => setFolder(folder === f.id ? null : f.id)}
                />
              ))}
          </View>
        )}
        {focus && (
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-sm text-ink">
              {t('graph.focusOn', { name: focused?.title || t('notes.untitled') })}
            </Text>
            {[1, 2, 3].map((d) => (
              <Chip
                key={d}
                role="radio"
                label={t('graph.steps', { count: d })}
                selected={depth === d}
                onPress={() => setDepth(d)}
              />
            ))}
            <Button
              variant="ghost"
              icon={X}
              label={t('graph.clearFocus')}
              onPress={() => setFocus(null)}
            />
          </View>
        )}
        {data.error ? (
          <EmptyState title={t('common.loadError', { message: data.error.message })} />
        ) : !graph || !positions ? (
          <Text className="text-sm text-ink-muted">{t('query.loading')}</Text>
        ) : graph.nodes.length === 0 ? (
          <EmptyState title={t('graph.empty')} hint={t('graph.emptyHint')} />
        ) : (
          <>
            <Text testID="graph-count" className="text-xs text-ink-muted">
              {`${t('graph.nodes', { count: graph.nodes.length })} · ${t('graph.links', { count: graph.edges.length })}`}
            </Text>
            <GraphCanvas
              graph={graph}
              positions={positions}
              focus={focus}
              height={Math.max(420, height - 340)}
              onOpen={openNode}
            />
          </>
        )}
      </ScreenScroll>
    </Screen>
  );
}
