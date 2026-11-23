import { router } from 'expo-router';
import { BookOpen, Check, Play } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { openMaterial } from '@/components/materials-section';
import { useTaskMaterialList } from '@/components/task-materials';
import { useToggleWithUndo } from '@/components/tasks/task-row';
import { usePomodoro } from '@/components/timer-bar';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { materialTitle } from '@/lib/materials';
import { readTask, setStudyFolders } from '@/lib/open-task';
import { useProjectAllTasks } from '@/lib/queries/flow';
import { useTask, type Task } from '@/lib/queries/tasks';
import { type FolderNode, useTree } from '@/lib/queries/tree';
import { nextSession } from '@/lib/study';
import { useTaskCan } from '@/providers/write';

// Estudar (ES7, ESCOPO_V13 §5, D328): o projeto de estudo abre as tarefas na ficha, mostra o que
// estudar agora e, na tela de leitura, a sessão da vez com foco e concluir.

/** Mantém a lista de pastas de estudo que o `openTask` consulta (a raiz e as subpastas) */
export function useStudyRegistry() {
  const tree = useTree();
  const roots = tree.data?.folders;
  useEffect(() => {
    const ids = new Set<string>();
    for (const root of roots ?? [])
      if (root.study) {
        ids.add(root.id);
        for (const child of root.children) ids.add(child.id);
      }
    setStudyFolders(ids);
  }, [roots]);
}

/** O que estudar agora: a próxima sessão aberta, com o material dela */
export function StudyNow({ root }: { root: FolderNode }) {
  const { t } = useTranslation();
  const tree = useTree();
  const tasks = useProjectAllTasks(root);
  const pomodoro = usePomodoro();
  const folderIds = new Set([root.id, ...root.children.map((c) => c.id)]);
  const pages = (tree.data?.pages ?? [])
    .filter((p) => folderIds.has(p.folder_id))
    .sort((a, b) =>
      a.folder_id === b.folder_id
        ? a.position - b.position
        : a.folder_id === root.id
          ? -1
          : b.folder_id === root.id
            ? 1
            : 0,
    );
  const next = tasks.data ? nextSession(pages, tasks.data) : null;
  const session = next?.task;
  const list = useTaskMaterialList(
    session
      ? {
          id: session.id,
          page_id: session.page_id,
          folder_id: session.folder_id,
          parent_task_id: session.parent_task_id,
        }
      : null,
  );
  if (!tasks.data) return null;
  return (
    <View className="mb-4 gap-2 rounded-lg border border-line bg-surface p-3" testID="study-now">
      <SectionLabel title={t('study.now')} className="pt-0" />
      {!session ? (
        <Text className="text-sm text-ink-muted">{t('study.allDone')}</Text>
      ) : (
        <>
          {next.parent && (
            <Text className="text-xs uppercase text-ink-muted" numberOfLines={1}>
              {next.parent.title}
            </Text>
          )}
          <Text className="font-serif text-lg text-ink" accessibilityRole="header">
            {session.title}
          </Text>
          {list.items.length > 0 && (
            <Text className="text-sm text-ink-muted" numberOfLines={2}>
              {list.items.map((m) => materialTitle(m.material_name)).join(' · ')}
            </Text>
          )}
          <View className="flex-row flex-wrap gap-2 pt-1">
            <Button
              icon={BookOpen}
              label={t(list.items.length ? 'study.read' : 'study.open')}
              onPress={() =>
                list.items.length
                  ? openMaterial({ id: list.items[0].material_id }, session.id)
                  : readTask(session.id)
              }
            />
            <Button
              variant="ghost"
              icon={Play}
              label={t('study.focus')}
              onPress={() => {
                void pomodoro.start({ id: session.id, title: session.title });
                router.push('/pomodoro');
              }}
            />
          </View>
        </>
      )}
    </View>
  );
}

/** A sessão da vez, embaixo da leitura: começar foco e concluir */
export function StudySessionBar({ taskId }: { taskId: string }) {
  const task = useTask(taskId);
  if (!task.data) return null;
  return <SessionBar task={task.data} />;
}

function SessionBar({ task }: { task: Task }) {
  const { t } = useTranslation();
  const pomodoro = usePomodoro();
  const toggle = useToggleWithUndo();
  const can = useTaskCan(task);
  const done = task.status === 'done';
  return (
    <View
      className="flex-row flex-wrap items-center gap-2 border-t border-line bg-surface px-3 py-2"
      testID="study-session"
    >
      <View className="min-w-40 flex-1">
        <Text className="text-xs uppercase text-ink-muted">{t('study.session')}</Text>
        <Text className="text-sm text-ink" numberOfLines={1}>
          {task.title}
        </Text>
      </View>
      <Button
        variant="ghost"
        icon={Play}
        label={t('study.focus')}
        onPress={() => void pomodoro.start({ id: task.id, title: task.title })}
      />
      {can.complete && (
        <Button
          icon={Check}
          label={t(done ? 'study.reopen' : 'study.complete')}
          variant={done ? 'ghost' : 'primary'}
          onPress={() => toggle(task, !done)}
        />
      )}
    </View>
  );
}
