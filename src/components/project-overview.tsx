import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ProgressBar } from '@/components/game-bar';
import { ProjectBoss } from '@/components/project-boss';
import { Avatar } from '@/components/ui/person';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { describeActivity } from '@/lib/activity';
import { projectProgress } from '@/lib/progress';
import { useActivity, useAssignees, useFolderTasks, useMembers } from '@/lib/queries/projects';
import type { FolderNode } from '@/lib/queries/tree';

const pct = (p: { done: number; total: number }) =>
  p.total ? Math.round((p.done / p.total) * 100) : 0;

/** Visão geral do projeto (ESCOPO 5, tela 6): progresso geral e por pessoa, boss e atividade. */
export function ProjectOverview({ root }: { root: FolderNode }) {
  const { t, i18n } = useTranslation();
  const members = useMembers(root.id);
  const assignees = useAssignees();
  const tasks = useFolderTasks(root);
  const activity = useActivity(root.id);
  const when = new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const folderIds = [root.id, ...root.children.map((c) => c.id)];
  const progress = projectProgress(
    tasks.data ?? [],
    (assignees.data ?? []).filter((a) => folderIds.includes(a.folder_id)),
  );

  return (
    <View className="gap-8">
      <View className="gap-2">
        <View className="flex-row items-baseline justify-between">
          <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('project.progress')}
          </Text>
          <Text
            className="font-mono text-xs text-ink-muted"
            accessibilityLabel={t('project.progressLabel')}
          >
            {progress.overall.done}/{progress.overall.total} · {pct(progress.overall)}%
          </Text>
        </View>
        <ProgressBar
          value={progress.overall.total ? progress.overall.done / progress.overall.total : 0}
          label={t('project.projectPct', { pct: pct(progress.overall) })}
        />
        <View className="pt-1">
          {members.data?.map((m) => {
            const p = progress.byUser.get(m.userId);
            return (
              <View key={m.userId} className="min-h-8 flex-row items-center gap-2">
                <Avatar name={m.displayName} />
                <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
                  {m.displayName}
                </Text>
                <Text
                  className="font-mono text-xs text-ink-muted"
                  accessibilityLabel={t('project.memberProgress', {
                    name: m.displayName,
                    done: p?.done ?? 0,
                    total: p?.total ?? 0,
                  })}
                >
                  {p ? `${p.done}/${p.total}` : '—'}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <ProjectBoss rootId={root.id} />

      {(activity.data?.length ?? 0) > 0 && (
        <View>
          <SectionLabel title={t('project.activity')} className="pt-0" />
          {activity.data?.map((a) => (
            <View
              key={a.id}
              className="min-h-10 flex-row items-center gap-3 border-b border-line py-1"
            >
              <Text className="flex-1 text-sm text-ink">{describeActivity(a)}</Text>
              <Text className="font-mono text-xs text-ink-muted">
                {when.format(new Date(a.created_at))}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
