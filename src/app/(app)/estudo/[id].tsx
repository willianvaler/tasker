import { router, useLocalSearchParams } from 'expo-router';
import { Pencil } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { FieldValues } from '@/components/fields';
import { Backlinks, OutgoingLinks, useOpenLink } from '@/components/note-links';
import { NoteMarkdown } from '@/components/note-markdown';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { StudyNav, StudySessionBar, useStudyRoot, useStudySequence } from '@/components/study';
import { TaskMaterials } from '@/components/task-materials';
import { Attachments } from '@/components/tasks/attachments';
import { TaskMeta } from '@/components/tasks/task-meta';
import { useToggleWithUndo } from '@/components/tasks/task-row';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { studyTask } from '@/lib/open-task';
import { useAttachments } from '@/lib/queries/attachments';
import { useLinkTitles } from '@/lib/queries/links';
import { useToday } from '@/lib/queries/profile';
import { usePageTasks, useTask, type Task } from '@/lib/queries/tasks';
import { findFolder, pageLabel, useTree } from '@/lib/queries/tree';
import { leafProgress } from '@/lib/task-tree';
import { useShortcut } from '@/lib/use-shortcut';
import { parseLinks } from '@/lib/wikilinks';
import { useTaskCan } from '@/providers/write';

/**
 * Tarefa do projeto de estudo na tela de leitura (CD46): na mesma janela do material, não no
 * painel. A descrição, o material e as subtarefas embaixo; **anterior / próximo** passam por
 * tarefas e materiais na ordem de leitura do projeto, como capítulos (`studySequence`).
 */
export default function StudyTaskScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const task = useTask(id);
  if (task.isPending) return <Screen size="wide">{null}</Screen>;
  if (!task.data)
    return (
      <Screen size="wide">
        <ScreenHeader title={t('taskDetail.title')} back />
        <EmptyState title={t('taskDetail.missing')} />
      </Screen>
    );
  return <StudyTask key={task.data.id} task={task.data} />;
}

function StudyTask({ task }: { task: Task }) {
  const { t } = useTranslation();
  const today = useToday();
  const tree = useTree();
  const can = useTaskCan(task);
  const siblings = usePageTasks(task.page_id);
  const root = useStudyRoot(task.folder_id);
  const steps = useStudySequence(root);
  const notes = task.notes ?? '';
  const resolve = useLinkTitles(
    parseLinks(notes).flatMap((l) => (l.kind && l.id ? [{ kind: l.kind, id: l.id }] : [])),
  );
  const openLink = useOpenLink();
  const edit = () => router.push({ pathname: '/task/[id]', params: { id: task.id } });
  useShortcut('reader.edit', edit);
  const attachments = useAttachments(task.id);

  const page = tree.data?.pages.find((p) => p.id === task.page_id);
  const place = page ? findFolder(tree.data, page.folder_id) : null;
  const subtasks = useMemo(
    () =>
      (siblings.data ?? [])
        .filter((s) => s.parent_task_id === task.id)
        .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)),
    [siblings.data, task.id],
  );
  const parent = siblings.data?.find((s) => s.id === task.parent_task_id);
  const progress = leafProgress(siblings.data ?? []).get(task.id);
  return (
    <Screen size="wide">
      {/* Concluir fica na barra da sessão, embaixo */}
      <ScreenHeader
        title={task.title}
        eyebrow={[place?.folder.name, page ? pageLabel(page) : null].filter(Boolean).join(' · ')}
        back
      />
      <View
        className="-mt-1 flex-row flex-wrap items-center justify-end pb-1"
        testID="reader-tools"
      >
        <Button variant="ghost" icon={Pencil} label={t('reader.edit')} onPress={edit} />
        <ThemeToggle />
        {steps && <StudyNav steps={steps} at={{ kind: 'task', id: task.id }} />}
      </View>
      <ScreenScroll contentContainerClassName="gap-3 pb-clear" testID="study-task">
        {parent && (
          <Pressable
            accessibilityRole="link"
            onPress={() => studyTask(parent.id)}
            className="self-start"
          >
            <Text className="text-sm text-accent">
              {t('reader.partOf', { title: parent.title })}
            </Text>
          </Pressable>
        )}
        <TaskMeta task={task} today={today} subtasks={progress} />
        <FieldValues task={task} />

        {notes.trim() ? (
          <View testID="reader-notes">
            <NoteMarkdown value={notes} resolve={resolve} onLink={openLink} />
            <OutgoingLinks body={notes} resolve={resolve} onOpen={openLink} />
          </View>
        ) : (
          <Text className="text-sm text-ink-muted">{t('reader.noNotes')}</Text>
        )}

        {subtasks.length > 0 && (
          <View>
            <SectionLabel
              title={t('taskDetail.subtasks')}
              count={`${subtasks.filter((s) => s.status === 'done').length}/${subtasks.length}`}
            />
            {subtasks.map((s) => (
              <SubtaskLine key={s.id} task={s} />
            ))}
          </View>
        )}

        {/* O material desta tarefa (o dela, ou o herdado da mãe ou da lista) */}
        <TaskMaterials task={task} editable={can.edit} />

        {(attachments.data?.length ?? 0) > 0 && <Attachments task={task} writable={false} />}
        <Backlinks kind="task" id={task.id} />
      </ScreenScroll>
      <StudySessionBar taskId={task.id} />
    </Screen>
  );
}

function SubtaskLine({ task }: { task: Task }) {
  const can = useTaskCan(task);
  const toggle = useToggleWithUndo();
  const { t } = useTranslation();
  const done = task.status === 'done';
  return (
    <View className="-ml-3 flex-row items-center border-b border-line md:-ml-2">
      <Checkbox
        checked={done}
        disabled={!can.complete}
        label={t(done ? 'task.reopen' : 'task.complete', { title: task.title })}
        onChange={(checked) => toggle(task, checked)}
      />
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('reader.open', { title: task.title })}
        className="min-h-11 flex-1 justify-center md:min-h-8"
        onPress={() => studyTask(task.id)}
      >
        <Text
          className={cn('text-base text-ink md:text-sm', done && 'text-ink-muted line-through')}
        >
          {task.title}
        </Text>
      </Pressable>
    </View>
  );
}
