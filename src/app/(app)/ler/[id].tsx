import { router, useLocalSearchParams } from 'expo-router';
import { Pencil, X } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { FieldValues } from '@/components/fields';
import { Backlinks, OutgoingLinks, useOpenLink } from '@/components/note-links';
import { NoteMarkdown } from '@/components/note-markdown';
import { TaskMaterials } from '@/components/task-materials';
import { Attachments } from '@/components/tasks/attachments';
import { TaskMeta } from '@/components/tasks/task-meta';
import { useToggleWithUndo } from '@/components/tasks/task-row';
import { Button, IconButton } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionLabel } from '@/components/ui/section-label';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { readTask } from '@/lib/open-task';
import { useAttachments } from '@/lib/queries/attachments';
import { useLinkTitles } from '@/lib/queries/links';
import { useToday } from '@/lib/queries/profile';
import { usePageTasks, useTask, type Task } from '@/lib/queries/tasks';
import { findFolder, pageLabel, useTree } from '@/lib/queries/tree';
import { leafProgress } from '@/lib/task-tree';
import { useShortcut } from '@/lib/use-shortcut';
import { parseLinks } from '@/lib/wikilinks';
import { useTaskCan } from '@/providers/write';

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** Editar: troca a ficha pelo painel (sem empilhar as duas) */
const edit = (id: string) => router.replace({ pathname: '/task/[id]', params: { id } });

/**
 * Ficha de leitura da tarefa (ES1, ESCOPO_V13 §1, D322): o que a tarefa é, para ler sem cair na
 * edição. Descrição formatada (o Markdown das anotações, com os links), dados, campos, anexos,
 * subtarefas (marcar continua valendo) e quem cita. **Editar** (ou `E`) abre o painel de sempre.
 */
export default function ReadTaskScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const task = useTask(id);
  if (task.isPending) return <Sheet onClose={close}>{null}</Sheet>;
  if (!task.data)
    return (
      <Sheet onClose={close} header={<Header path={t('taskDetail.title')} />}>
        <EmptyState title={t('taskDetail.missing')} />
      </Sheet>
    );
  return <TaskReader key={task.data.id} task={task.data} />;
}

function Header({ path, onEdit }: { path: string; onEdit?: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="min-h-12 flex-row items-center gap-2 border-b border-line pl-4 pr-2">
      <Text className="flex-1 font-mono text-xs uppercase text-ink-muted" numberOfLines={1}>
        {path}
      </Text>
      {onEdit && <Button variant="ghost" icon={Pencil} label={t('reader.edit')} onPress={onEdit} />}
      <IconButton icon={X} label={t('common.back')} onPress={close} />
    </View>
  );
}

function TaskReader({ task }: { task: Task }) {
  const { t } = useTranslation();
  const today = useToday();
  const tree = useTree();
  const can = useTaskCan(task);
  const toggle = useToggleWithUndo();
  const siblings = usePageTasks(task.page_id);
  const notes = task.notes ?? '';
  const resolve = useLinkTitles(
    parseLinks(notes).flatMap((l) => (l.kind && l.id ? [{ kind: l.kind, id: l.id }] : [])),
  );
  // Só ler: link para o que não existe abre (ou cria) a anotação, sem reescrever a descrição
  const openLink = useOpenLink();
  useShortcut('reader.edit', () => edit(task.id));
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
  const done = task.status === 'done';

  return (
    <Sheet
      onClose={close}
      header={
        <Header
          path={[place?.folder.name, page ? pageLabel(page) : null].filter(Boolean).join(' / ')}
          onEdit={() => edit(task.id)}
        />
      }
    >
      <View className="-ml-3 flex-row items-start md:-ml-2">
        <Checkbox
          checked={done}
          disabled={!can.complete}
          label={t(done ? 'taskDetail.reopen' : 'taskDetail.complete')}
          onChange={(checked) => toggle(task, checked)}
        />
        <Text
          accessibilityRole="header"
          className={cn(
            'flex-1 py-1 text-lg font-semibold text-ink',
            done && 'text-ink-muted line-through',
          )}
        >
          {task.title}
        </Text>
      </View>
      {parent && (
        <Pressable
          accessibilityRole="link"
          onPress={() => readTask(parent.id)}
          className="self-start"
        >
          <Text className="text-sm text-accent">{t('reader.partOf', { title: parent.title })}</Text>
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
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-sm text-ink-muted">{t('reader.noNotes')}</Text>
          {can.edit && (
            <Button variant="ghost" label={t('reader.addNotes')} onPress={() => edit(task.id)} />
          )}
        </View>
      )}

      {/* O material de estudo ligado (ES6): pelo código, à mão, ou herdado da mãe ou da lista */}
      <TaskMaterials task={task} editable={can.edit} />

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

      {(attachments.data?.length ?? 0) > 0 && <Attachments task={task} writable={false} />}
      <Backlinks kind="task" id={task.id} />
    </Sheet>
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
        onPress={() => readTask(task.id)}
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
