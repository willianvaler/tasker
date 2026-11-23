import { router } from 'expo-router';
import { BookOpen, Check, ChevronLeft, ChevronRight, Play } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { openMaterial } from '@/components/materials-section';
import { useTaskMaterialList } from '@/components/task-materials';
import { useToggleWithUndo } from '@/components/tasks/task-row';
import { usePomodoro } from '@/components/timer-bar';
import { Button, IconButton } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { materialTitle } from '@/lib/materials';
import { setStudyFolders, studyTask } from '@/lib/open-task';
import { useMaterialLinks } from '@/lib/queries/materials';
import { useProjectAllTasks } from '@/lib/queries/flow';
import { useTask, type Task } from '@/lib/queries/tasks';
import { findFolder, type FolderNode, type Page, useTree } from '@/lib/queries/tree';
import { nextSession, stepIndex, studySequence, type StudyStep } from '@/lib/study';
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

/** As listas do projeto na ordem de leitura: as da raiz, depois as das subpastas */
export function studyPages<P extends Pick<Page, 'folder_id' | 'position'>>(
  pages: readonly P[],
  root: Pick<FolderNode, 'id' | 'children'>,
) {
  const folderIds = new Set([root.id, ...root.children.map((c) => c.id)]);
  return pages
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
}

/** O projeto (a raiz) de uma pasta, e se ele é de estudo */
export function useStudyRoot(folderId: string | null | undefined) {
  const tree = useTree();
  const found = folderId ? findFolder(tree.data, folderId) : null;
  const root = found?.parent ?? (found && 'children' in found.folder ? found.folder : undefined);
  return root?.study ? root : undefined;
}

/** A ordem de leitura do projeto de estudo (capítulos, CD46) */
export function useStudySequence(root: FolderNode | undefined) {
  const tree = useTree();
  const tasks = useProjectAllTasks(root);
  const links = useMaterialLinks(root?.id, !!root);
  if (!root || !tasks.data || !links.data) return null;
  return studySequence(studyPages(tree.data?.pages ?? [], root), tasks.data, links.data);
}

/** Vai para outro passo sem empilhar (como virar o capítulo) */
export function goToStep(step: StudyStep) {
  if (step.kind === 'task') router.replace({ pathname: '/estudo/[id]', params: { id: step.id } });
  else
    router.replace({
      pathname: '/material/[id]',
      params: step.task ? { id: step.id, tarefa: step.task } : { id: step.id },
    });
}

/** Anterior e próximo na ordem de leitura, com "3 de 40" */
export function StudyNav({
  steps,
  at,
}: {
  steps: readonly StudyStep[];
  at: Parameters<typeof stepIndex>[1];
}) {
  const { t } = useTranslation();
  const i = stepIndex(steps, at);
  const prev = i > 0 ? steps[i - 1] : null;
  const next = i >= 0 && i < steps.length - 1 ? steps[i + 1] : null;
  return (
    <>
      {i >= 0 && (
        <Text className="px-1 font-mono text-xs text-ink-muted" testID="study-position">
          {t('study.position', { n: i + 1, total: steps.length })}
        </Text>
      )}
      <IconButton
        icon={ChevronLeft}
        label={t('study.prev')}
        disabled={!prev}
        onPress={() => prev && goToStep(prev)}
      />
      <IconButton
        icon={ChevronRight}
        label={t('study.next')}
        disabled={!next}
        onPress={() => next && goToStep(next)}
      />
    </>
  );
}

/** O que estudar agora: a próxima sessão aberta, com o material dela */
export function StudyNow({ root }: { root: FolderNode }) {
  const { t } = useTranslation();
  const tree = useTree();
  const tasks = useProjectAllTasks(root);
  const pomodoro = usePomodoro();
  const pages = studyPages(tree.data?.pages ?? [], root);
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
                  : studyTask(session.id)
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
