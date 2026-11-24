import { router, useLocalSearchParams } from 'expo-router';
import { FileText } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { READABLE, Screen, ScreenScroll } from '@/components/screen';
import { openTask } from '@/lib/open-task';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { formatShortDate } from '@/lib/parser/dates';
import { actorCan } from '@/lib/permissions';
import { useProjectFlow } from '@/lib/queries/flow';
import { useMilestoneMutations, useMilestones } from '@/lib/queries/milestones';
import { useNoteMutations } from '@/lib/queries/notes';
import { useToday } from '@/lib/queries/profile';
import { rootFolder, useFolderActor } from '@/lib/queries/projects';
import { useTree } from '@/lib/queries/tree';
import { buildRoadmap, releaseNotes } from '@/lib/roadmap';
import { taskState } from '@/lib/task-state';
import { useToast } from '@/providers/toast';
import { useCanWrite } from '@/providers/write';

/**
 * Roadmap do projeto (GP3, D315): os marcos em ordem de data, cada um com as tarefas ligadas, o
 * progresso, o que atrasou e o que está bloqueado (estado derivado, D108). Marco vencido com tarefa
 * aberta fica em destaque; o concluído oferece as notas da versão.
 */
export default function RoadmapScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const today = useToday();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tree = useTree();
  const root = rootFolder(tree.data, id);
  const milestones = useMilestones(root?.id);
  const m = useMilestoneMutations(root?.id ?? '');
  const flow = useProjectFlow(root ?? undefined);
  const notes = useNoteMutations();
  const actor = useFolderActor(root?.id);
  const manage = useCanWrite(root?.id, { offline: true }) && actorCan(actor, 'page.manage');
  const writeNotes = useCanWrite(root?.id, { offline: true }) && actorCan(actor, 'task.create');

  const now = new Date();
  const { entries, unlinked } = buildRoadmap(
    milestones.data ?? [],
    [...flow.tasks.values()],
    today,
    (taskId) =>
      taskState(taskId, flow.tasks, flow.deps, now, flow.blockedPages).state === 'blocked',
  );

  async function notesFor(index: number) {
    const entry = entries[index];
    if (!root || !entry) return;
    try {
      const noteId = await notes.create.mutateAsync({
        folderId: root.id,
        title: t('roadmap.notesTitle', { name: entry.milestone.name }),
        body: releaseNotes(entry, entry.milestone.done_at?.slice(0, 10) ?? today),
      });
      toast({ message: t('roadmap.notesCreated') });
      router.push(`/nota/${noteId}`);
    } catch (e) {
      toast({ message: (e as Error).message });
    }
  }

  return (
    <Screen size="medium">
      <ScreenScroll contentContainerClassName="pb-clear">
        <ScreenHeader back title={t('roadmap.title')} eyebrow={root?.name} />
        <View className={cn(READABLE, 'gap-8')}>
          {!milestones.isPending && entries.length === 0 ? (
            <EmptyState title={t('roadmap.empty')} />
          ) : (
            entries.map((entry, index) => {
              const { milestone } = entry;
              const done = !!milestone.done_at;
              return (
                <View
                  key={milestone.id}
                  role="region"
                  aria-label={milestone.name}
                  className={cn(
                    'gap-2 rounded border border-line p-4',
                    entry.overdue && 'border-danger',
                  )}
                >
                  <View className="flex-row flex-wrap items-baseline gap-2">
                    <Text
                      className={cn('flex-1 font-serif text-lg text-ink', done && 'text-ink-muted')}
                    >
                      {milestone.name}
                    </Text>
                    <Text className="text-sm text-ink-muted">
                      {[
                        milestone.due_date
                          ? formatShortDate(milestone.due_date)
                          : t('roadmap.noDate'),
                        done ? t('roadmap.done') : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  {entry.total > 0 && (
                    <>
                      <ProgressBar
                        value={entry.done / entry.total}
                        label={t('roadmap.progress', { done: entry.done, total: entry.total })}
                      />
                      <Text className="text-sm text-ink-muted">
                        {[
                          t('roadmap.progress', { done: entry.done, total: entry.total }),
                          entry.late ? t('roadmap.late', { count: entry.late }) : null,
                          entry.blocked ? t('roadmap.blocked', { count: entry.blocked }) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </>
                  )}
                  {entry.overdue && (
                    <Text className="text-sm text-danger">{t('roadmap.overdue')}</Text>
                  )}
                  {entry.tasks.length === 0 ? (
                    <Text className="text-sm text-ink-muted">{t('roadmap.noTasks')}</Text>
                  ) : (
                    entry.tasks.map((task) => {
                      const late =
                        task.status !== 'done' && !!task.due_date && task.due_date < today;
                      const blocked =
                        task.status !== 'done' &&
                        taskState(task.id, flow.tasks, flow.deps, now, flow.blockedPages).state ===
                          'blocked';
                      return (
                        <Pressable
                          key={task.id}
                          accessibilityRole="link"
                          onPress={() => openTask(task.id, root?.id)}
                          className="flex-row items-center gap-2 py-1"
                        >
                          <Text
                            className={cn(
                              'flex-1 text-ink',
                              task.status === 'done' && 'text-ink-muted line-through',
                            )}
                          >
                            {task.title}
                          </Text>
                          {(late || blocked) && (
                            <Text className={cn('text-xs', late ? 'text-danger' : 'text-warn')}>
                              {[
                                late ? t('roadmap.taskLate') : null,
                                blocked ? t('roadmap.taskBlocked') : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </Text>
                          )}
                        </Pressable>
                      );
                    })
                  )}
                  <View className="flex-row flex-wrap gap-2 pt-1">
                    {manage && (
                      <Button
                        variant="ghost"
                        label={done ? t('roadmap.reopen') : t('roadmap.markDone')}
                        onPress={() =>
                          m.update.mutate({
                            id: milestone.id,
                            done_at: done ? null : new Date().toISOString(),
                          })
                        }
                      />
                    )}
                    {done && writeNotes && entry.total > 0 && (
                      <Button
                        variant="ghost"
                        icon={FileText}
                        label={t('roadmap.releaseNotes')}
                        onPress={() => void notesFor(index)}
                      />
                    )}
                  </View>
                </View>
              );
            })
          )}
          {unlinked > 0 && (
            <View>
              <SectionLabel title={t('roadmap.unlinked', { count: unlinked })} />
            </View>
          )}
        </View>
      </ScreenScroll>
    </Screen>
  );
}
