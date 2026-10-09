import { Text, View } from 'react-native';

import { ProgressBar } from '@/components/game-bar';
import { ProjectBoss } from '@/components/project-boss';
import { describeActivity } from '@/lib/activity';
import { initials } from '@/lib/members';
import { projectProgress } from '@/lib/progress';
import { useActivity, useAssignees, useFolderTasks, useMembers } from '@/lib/queries/projects';
import type { FolderNode } from '@/lib/queries/tree';

const WHEN = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const pct = (p: { done: number; total: number }) =>
  p.total ? Math.round((p.done / p.total) * 100) : 0;

/** Visão geral do projeto (ESCOPO 5, tela 6): pessoas, progresso e atividade. */
export function ProjectOverview({ root }: { root: FolderNode }) {
  const members = useMembers(root.id);
  const assignees = useAssignees();
  const tasks = useFolderTasks(root);
  const activity = useActivity(root.id);

  const folderIds = [root.id, ...root.children.map((c) => c.id)];
  const progress = projectProgress(
    tasks.data ?? [],
    (assignees.data ?? []).filter((a) => folderIds.includes(a.folder_id)),
  );

  return (
    <View className="gap-4">
      <ProjectBoss rootId={root.id} />
      <View className="gap-2 rounded-xl border border-border bg-card p-3">
        <View className="flex-row items-baseline justify-between">
          <Text className="font-semibold text-foreground">Progresso</Text>
          <Text className="text-sm text-muted-foreground" accessibilityLabel="Progresso do projeto">
            {progress.overall.done}/{progress.overall.total} · {pct(progress.overall)}%
          </Text>
        </View>
        <ProgressBar
          value={progress.overall.total ? progress.overall.done / progress.overall.total : 0}
          label={`Projeto: ${pct(progress.overall)}% concluído`}
        />
        {members.data?.map((m) => {
          const p = progress.byUser.get(m.userId);
          return (
            <View key={m.userId} className="flex-row items-center gap-2">
              <View className="h-6 w-6 items-center justify-center rounded-full bg-primary">
                <Text className="text-[10px] font-bold text-primary-foreground">
                  {initials(m.displayName)}
                </Text>
              </View>
              <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
                {m.displayName}
              </Text>
              <Text
                className="text-xs text-muted-foreground"
                accessibilityLabel={`${m.displayName}: ${p?.done ?? 0} de ${p?.total ?? 0}`}
              >
                {p ? `${p.done}/${p.total}` : '—'}
              </Text>
            </View>
          );
        })}
      </View>

      {(activity.data?.length ?? 0) > 0 && (
        <View className="gap-1">
          <Text className="font-semibold text-foreground">Atividade</Text>
          {activity.data?.map((a) => (
            <View key={a.id} className="flex-row gap-2 py-1">
              <Text className="flex-1 text-sm text-foreground">{describeActivity(a)}</Text>
              <Text className="text-xs text-muted-foreground">
                {WHEN.format(new Date(a.created_at))}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
