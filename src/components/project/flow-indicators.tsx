import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { openTask } from '@/components/project/flow-parts';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { buildFlow } from '@/lib/flow-graph';
import { bottlenecks, overdueByPerson } from '@/lib/flow-stats';
import { actorCan } from '@/lib/permissions';
import { useProjectFlow } from '@/lib/queries/flow';
import { useToday } from '@/lib/queries/profile';
import { useFolderActor } from '@/lib/queries/projects';
import type { FolderNode } from '@/lib/queries/tree';
import { supabase } from '@/lib/supabase';
import { formatDuration } from '@/lib/task-tree';

type Stat = { minutes: number | null; count: number };
type Stats = { waiting: Stat; to_start: Stat; doing: Stat };

/**
 * Indicadores do fluxo (I6, V3 §2.7) na aba Lista, em frases curtas: o que mais segura o projeto,
 * o caminho crítico, quem tem tarefa atrasada e, para quem audita, os tempos médios.
 */
export function FlowIndicators({ root }: { root: FolderNode }) {
  const { t } = useTranslation();
  const today = useToday();
  const data = useProjectFlow(root);
  const audit = actorCan(useFolderActor(root.id), 'workflow.view_audit');
  const stats = useQuery({
    queryKey: ['flow-stats', root.id],
    enabled: audit,
    queryFn: async () => {
      const { data: result, error } = await supabase.rpc('project_flow_stats', { p_root: root.id });
      if (error) throw error;
      return result as unknown as Stats;
    },
  });

  if (data.loading) return null;
  const holding = bottlenecks(data.tasks, data.deps);
  const critical = buildFlow({ tasks: data.tasks, deps: data.deps, people: data.people }).critical;
  const late = overdueByPerson(data.tasks, data.people, today);
  const times = (['waiting', 'to_start', 'doing'] as const).filter(
    (k) => (stats.data?.[k]?.count ?? 0) > 0 && stats.data?.[k]?.minutes != null,
  );
  if (!holding.length && !critical?.minutes && !late.length && !times.length) return null;

  return (
    <View role="region" aria-label={t('indicators.title')}>
      <SectionLabel title={t('indicators.title')} className="pt-0" />
      <View className="gap-2">
        {holding.length > 0 && (
          <View className="flex-row flex-wrap items-center gap-x-2">
            <Text className="text-sm text-ink-muted">{t('indicators.holding')}</Text>
            {holding.map((b) => (
              <Pressable
                key={b.id}
                accessibilityRole="button"
                accessibilityLabel={t('indicators.holds', { title: b.title, count: b.holds })}
                onPress={() => openTask(b.id)}
                className="min-h-8 justify-center"
              >
                <Text className="text-sm text-ink underline">
                  {b.title} <Text className="font-mono text-xs text-ink-muted">({b.holds})</Text>
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        {critical && critical.minutes > 0 && (
          <Text className="text-sm text-ink">
            {t('flowView.criticalSummary', {
              time: formatDuration(critical.minutes),
              count: critical.count,
            })}
          </Text>
        )}
        {late.length > 0 && (
          <Text className="text-sm text-ink">
            {t('indicators.late')}{' '}
            {late.map((l) => `${l.name || t('people.unassigned')} ${l.count}`).join(' · ')}
          </Text>
        )}
        {times.length > 0 && (
          <Text className="text-sm text-ink-muted">
            {t('indicators.average')}{' '}
            {times
              .map((k) =>
                t(`indicators.${k}`, {
                  time: formatDuration(Math.max(1, stats.data![k].minutes!)),
                }),
              )
              .join(' · ')}
          </Text>
        )}
      </View>
    </View>
  );
}
