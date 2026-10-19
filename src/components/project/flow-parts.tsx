import { router } from 'expo-router';
import { Check, Clock, Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { flowSteps, type FlowGraph, type FlowNode } from '@/lib/flow-graph';
import { formatDuration } from '@/lib/task-tree';
import type { TaskState } from '@/lib/task-state';

export const openTask = (id: string) => router.push({ pathname: '/task/[id]', params: { id } });

/** Ícone e cor de cada estado (o mesmo da linha da lista). */
export function StateMark({ state }: { state: TaskState }) {
  if (state === 'done') return <Icon icon={Check} size={16} tone="ink-muted" />;
  if (state === 'blocked') return <Icon icon={Lock} size={16} tone="ink-muted" />;
  if (state === 'doing') return <Icon icon={Clock} size={16} tone="accent" />;
  return <View className="mx-1 h-2 w-2 rounded-full bg-ok" />;
}

const STATE_LABEL = {
  done: 'people.done',
  blocked: 'flow.locked',
  doing: 'flow.doing',
  ready: 'flow.ready',
} as const;

/** O que se lê de um nó (rótulo acessível do grafo e linha da lista). */
export function useNodeText() {
  const { t } = useTranslation();
  return (node: FlowNode, titleOf: (id: string) => string | undefined) => {
    const parts = [node.title, t(STATE_LABEL[node.state])];
    if (node.state === 'blocked' && node.waitingOn.length)
      parts.push(
        t('flow.blocked', { names: node.waitingOn.map((id) => titleOf(id) ?? '…').join(', ') }),
      );
    if (node.people.length) parts.push(node.people.map((p) => p.name).join(', '));
    if (node.mine) parts.push(t('flowView.yourTurn'));
    if (node.critical) parts.push(t('flowView.critical'));
    return parts.join(' · ');
  };
}

/** Resumo em cima do grafo: onde o projeto está e o caminho crítico. */
export function FlowSummary({ graph }: { graph: FlowGraph }) {
  const { t } = useTranslation();
  const frontier = graph.nodes.filter((n) => n.frontier);
  const mine = frontier.filter((n) => n.mine).length;
  return (
    <View className="gap-1">
      <Text className="text-sm text-ink">
        {frontier.length
          ? mine
            ? t('flowView.hereMine', { count: frontier.length, mine })
            : t('flowView.here', { count: frontier.length })
          : t('flowView.nothingReady')}
      </Text>
      {graph.critical && graph.critical.minutes > 0 && (
        <Text className="text-sm text-ink-muted">
          {t('flowView.criticalSummary', {
            time: formatDuration(graph.critical.minutes),
            count: graph.critical.count,
          })}
        </Text>
      )}
    </View>
  );
}

/** Alternativa em lista ao grafo (V3 §11): as etapas em ordem, legível por leitor de tela. */
export function FlowList({
  graph,
  titleOf,
}: {
  graph: FlowGraph;
  titleOf: (id: string) => string | undefined;
}) {
  const { t } = useTranslation();
  const text = useNodeText();
  return (
    <View className="gap-4">
      {flowSteps(graph.nodes).map((step, index) => (
        <View
          key={index}
          accessibilityRole="list"
          aria-label={t('flowView.step', { n: index + 1 })}
        >
          <Text className="pb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('flowView.step', { n: index + 1 })}
          </Text>
          {step.map((node) => (
            <Pressable
              key={node.id}
              accessibilityRole="button"
              accessibilityLabel={text(node, titleOf)}
              onPress={() => openTask(node.id)}
              className={cn(
                'min-h-11 flex-row items-center gap-2 border-b border-line px-2 py-1 hover:bg-wash md:min-h-10',
                node.frontier && 'border-l-2 border-l-accent pl-2',
              )}
            >
              <StateMark state={node.state} />
              <View className="flex-1">
                <Text
                  className={cn(
                    'text-sm text-ink',
                    node.state === 'done' && 'text-ink-muted line-through',
                    node.critical && 'font-semibold',
                  )}
                  numberOfLines={1}
                >
                  {node.title}
                </Text>
                {node.state === 'blocked' && (
                  <Text className="text-xs text-ink-muted" numberOfLines={1}>
                    {t('flow.blocked', {
                      names: node.waitingOn.map((id) => titleOf(id) ?? '…').join(', '),
                    })}
                  </Text>
                )}
              </View>
              {node.mine && (
                <Text className="rounded bg-accent-soft px-1 text-xs font-semibold text-accent">
                  {t('flowView.yourTurn')}
                </Text>
              )}
              {node.people.length > 0 && (
                <Text className="text-xs text-ink-muted" numberOfLines={1}>
                  {node.people.map((p) => p.name).join(', ')}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}
