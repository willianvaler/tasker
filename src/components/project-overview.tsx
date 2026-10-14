import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ProgressBar } from '@/components/game-bar';
import { ProjectBoss } from '@/components/project-boss';
import { ProjectMilestones } from '@/components/project-milestones';
import { ToggleRow } from '@/components/ui/toggle-row';
import { actorCan } from '@/lib/permissions';
import { Avatar } from '@/components/ui/person';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { describeActivity } from '@/lib/activity';
import { projectProgress } from '@/lib/progress';
import {
  useActivity,
  useAssignees,
  useFolderActor,
  useFolderTasks,
  useMembers,
} from '@/lib/queries/projects';
import { useTreeMutations } from '@/lib/queries/tree';
import type { FolderNode } from '@/lib/queries/tree';

const pct = (p: { done: number; total: number }) =>
  p.total ? Math.round((p.done / p.total) * 100) : 0;

const ROLE_LABEL = {
  owner: 'share.roleOwner',
  manager: 'share.roleManager',
  editor: 'share.roleEditor',
  contributor: 'share.roleContributor',
  viewer: 'share.roleViewer',
} as const;

/** Visão geral do projeto: progresso geral e por pessoa (com o cargo), marcos, boss e atividade. */
export function ProjectOverview({ root }: { root: FolderNode }) {
  const { t, i18n } = useTranslation();
  const members = useMembers(root.id);
  const assignees = useAssignees();
  const tasks = useFolderTasks(root);
  const activity = useActivity(root.id);
  const actor = useFolderActor(root.id);
  const treeMutations = useTreeMutations();
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
                  <Text className="font-mono text-xs text-ink-muted">
                    {'  '}
                    {m.customRole?.name ?? t(ROLE_LABEL[m.role])}
                  </Text>
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

      <ProjectMilestones rootId={root.id} />

      <ProjectBoss rootId={root.id} />

      {actorCan(actor, 'page.manage') && (
        <ToggleRow
          title={t('project.autoCompleteParent')}
          hint={t('project.autoCompleteParentHint')}
          value={root.auto_complete_parent}
          onChange={(value) =>
            treeMutations.setFolderSettings.mutate({ id: root.id, auto_complete_parent: value })
          }
        />
      )}

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
