import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { FlowCanvas } from '@/components/project/flow-canvas';
import { FlowList, FlowSummary } from '@/components/project/flow-parts';
import { useIsWide } from '@/components/sidebar';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { buildFlow } from '@/lib/flow-graph';
import { actorCan } from '@/lib/permissions';
import { useProjectFlow } from '@/lib/queries/flow';
import { useFolderActor } from '@/lib/queries/projects';
import type { FolderNode } from '@/lib/queries/tree';
import { useSession } from '@/providers/session';
import { useCanWrite } from '@/providers/write';

/**
 * Visão Fluxo (V3 §2.6): o grafo das tarefas ligadas, da esquerda para a direita. No computador,
 * arrastar de uma tarefa para outra cria a ligação; no celular, só leitura. Sempre dá para ver como
 * lista (no app nativo, só a lista).
 */
export function FlowView({ root }: { root: FolderNode }) {
  const { t } = useTranslation();
  const { session } = useSession();
  const me = session?.user.id;
  const data = useProjectFlow(root);
  const wide = useIsWide();
  const actor = useFolderActor(root.id);
  const writable = useCanWrite(root.id, { offline: true });
  const [lanes, setLanes] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [asList, setAsList] = useState(Platform.OS !== 'web');

  const graph = buildFlow({
    tasks: data.tasks,
    deps: data.deps,
    people: data.people,
    me,
    hideDone: !showDone,
    blockedPages: data.blockedPages,
  });
  const titleOf = (id: string) => data.tasks.get(id)?.title;
  const myName = data.members.find((m) => m.userId === me)?.displayName;

  if (data.loading) return null;
  if (!data.deps.length)
    return <EmptyState title={t('flowView.empty')} hint={t('flowView.emptyHint')} />;

  return (
    <View className="flex-1 gap-3">
      <FlowSummary graph={graph} />
      <View className="flex-row flex-wrap items-center gap-2">
        {Platform.OS === 'web' && (
          <Chip label={t('flowView.asList')} selected={asList} onPress={() => setAsList(!asList)} />
        )}
        {!asList && (
          <Chip label={t('flowView.lanes')} selected={lanes} onPress={() => setLanes(!lanes)} />
        )}
        <Chip
          label={t('flowView.showDone')}
          selected={showDone}
          onPress={() => setShowDone(!showDone)}
        />
        {graph.hiddenDone > 0 && (
          <Text className="text-xs text-ink-muted">
            {t('flowView.hiddenDone', { count: graph.hiddenDone })}
          </Text>
        )}
      </View>
      {asList ? (
        <FlowList graph={graph} titleOf={titleOf} />
      ) : (
        <FlowCanvas
          rootId={root.id}
          graph={graph}
          lanes={lanes}
          myName={myName}
          titleOf={titleOf}
          canLink={wide && writable && actorCan(actor, 'dependency.manage')}
        />
      )}
    </View>
  );
}
