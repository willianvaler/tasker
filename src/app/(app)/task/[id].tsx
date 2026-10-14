import { uuidv7 } from '@/lib/uuid';
import { router, useLocalSearchParams } from 'expo-router';
import { FolderInput, Trash2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import { useHabitDates } from '@/components/tasks/habit-row';
import {
  HabitHistory,
  HabitKindEditor,
  MetaEditor,
  RecurrenceEditor,
} from '@/components/tasks/task-extras';
import { useToggleWithUndo } from '@/components/tasks/task-row';
import { Text, textClass } from '@/components/ui/text';
import type { Json } from '@/lib/db';
import { asRecurrence } from '@/lib/recurrence';
import { Button, IconButton } from '@/components/ui/button';
import { ConflictNotice } from '@/components/tasks/conflict-notice';
import { Checkbox } from '@/components/ui/checkbox';
import { Chip as UiChip } from '@/components/ui/chip';
import { ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/cn';
import { useColors } from '@/lib/tokens';
import { addDays, formatDueDate } from '@/lib/parser/dates';
import { parseQuickInput } from '@/lib/parser/quick';
import { useToday } from '@/lib/queries/profile';
import {
  useCreateSubtask,
  useDeleteTask,
  usePageTasks,
  useTask,
  useUpdateTask,
  type Task,
  type TaskPatch,
} from '@/lib/queries/tasks';
import { findFolder, pageLabel, useTree } from '@/lib/queries/tree';
import { AssigneesEditor, Comments } from '@/components/tasks/task-collab';
import { rootFolder } from '@/lib/queries/projects';
import { useCanWrite, WriteScope } from '@/providers/write';

const PRIORITIES = [
  { value: 0, label: 'taskDetail.priorityNone' },
  { value: 1, label: 'taskDetail.priorityLow' },
  { value: 2, label: 'taskDetail.priorityMid' },
  { value: 3, label: 'taskDetail.priorityHigh' },
] as const;

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

// Painel da tarefa: à direita no computador, sem travar a lista
// ao lado; folha de baixo para cima no celular. Nunca obrigatório: notas, prioridade, data,
// etiquetas, subtarefas, mover de página e apagar. Cada campo salva sozinho ao sair dele.
export default function TaskScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const task = useTask(id);

  if (task.isPending) return <Sheet onClose={close}>{null}</Sheet>;
  if (!task.data) {
    return (
      <Sheet onClose={close} header={<PanelHeader path={t('taskDetail.title')} />}>
        <EmptyState title={t('taskDetail.missing')} />
      </Sheet>
    );
  }
  // Os campos começam com os valores da tarefa e salvam ao sair; key = id para reiniciar ao trocar de tarefa
  return <TaskDetails key={task.data.id} task={task.data} />;
}

/** Topo do painel: caminho em mono e o botão de fechar ("Voltar", como o resto do app). */
function PanelHeader({ path }: { path: string }) {
  const { t } = useTranslation();
  return (
    <View className="min-h-12 flex-row items-center gap-2 border-b border-line pl-4 pr-2">
      <Text className="flex-1 font-mono text-xs uppercase text-ink-muted" numberOfLines={1}>
        {path}
      </Text>
      <IconButton icon={X} label={t('common.back')} onPress={close} />
    </View>
  );
}

function TaskDetails({ task }: { task: Task }) {
  const { t } = useTranslation();
  const colors = useColors();
  const today = useToday();
  const writable = useCanWrite(task.folder_id);
  const tree = useTree();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const toggle = useToggleWithUndo();
  const [confirmDelete, setConfirmDelete, closeConfirm] = useDialog<true>();

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? '');
  const [labels, setLabels] = useState(task.labels.map((l) => `#${l}`).join(' '));
  const [dateText, setDateText] = useState('');
  const [moving, setMoving] = useState(false);

  const save = (patch: TaskPatch) => update.mutate({ id: task.id, patch });
  const done = task.status === 'done';
  const page = tree.data?.pages.find((p) => p.id === task.page_id);
  const place = page ? findFolder(tree.data, page.folder_id) : null;
  const isHabit = page?.view_type === 'habits';
  const habitDates = useHabitDates(isHabit ? [task] : []);
  // Projeto (pasta compartilhada): responsáveis e comentários
  const project = !!rootFolder(tree.data, task.folder_id)?.is_shared;

  function saveDateText() {
    const parsed = parseQuickInput(`x ${dateText}`, { today });
    if (parsed.dueDate) {
      save({ due_date: parsed.dueDate });
      setDateText('');
    }
  }

  return (
    <WriteScope folderId={task.folder_id}>
      <Sheet
        onClose={close}
        header={
          <PanelHeader
            path={[
              place?.folder.name,
              page ? pageLabel(page) : null,
              task.parent_task_id ? t('taskDetail.subtask') : null,
            ]
              .filter(Boolean)
              .join(' / ')}
          />
        }
      >
        <View className="-ml-3 flex-row items-start md:-ml-2">
          {/* Contador e bom/ruim se marcam pelo + e − da linha do hábito */}
          {(!isHabit || task.habit_kind === 'check') && (
            <Checkbox
              checked={done}
              disabled={!writable}
              label={t(done ? 'taskDetail.reopen' : 'taskDetail.complete')}
              onChange={(checked) => toggle(task, checked)}
            />
          )}
          <TextInput
            value={title}
            onChangeText={setTitle}
            onBlur={() =>
              title.trim() && title.trim() !== task.title && save({ title: title.trim() })
            }
            editable={writable}
            multiline
            maxLength={500}
            accessibilityLabel={t('taskDetail.titleField')}
            className={textClass(
              cn(
                'flex-1 py-1 text-lg font-semibold text-ink',
                done && 'text-ink-muted line-through',
              ),
            )}
          />
        </View>

        <Section title={t('taskDetail.notes')}>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            onBlur={() => notes !== (task.notes ?? '') && save({ notes: notes.trim() || null })}
            editable={writable}
            multiline
            placeholder={t('taskDetail.notesPlaceholder')}
            placeholderTextColor={colors['ink-muted']}
            accessibilityLabel={t('taskDetail.notes')}
            textAlignVertical="top"
            className={textClass(
              'min-h-20 rounded border border-line bg-paper p-3 text-base text-ink focus:border-accent',
            )}
          />
          <ConflictNotice
            taskId={task.id}
            writable={writable}
            onRestore={(body) => {
              setNotes(body);
              save({ notes: body });
            }}
          />
        </Section>

        {isHabit && !task.parent_task_id && (
          <Section title={t('taskDetail.habitKind')}>
            <HabitKindEditor task={task} onSave={save} />
          </Section>
        )}

        {isHabit && !task.parent_task_id && task.habit_kind !== 'plusminus' && (
          <Section title={t('taskDetail.history')}>
            <HabitHistory task={task} dates={habitDates.datesOf(task)} today={today} />
          </Section>
        )}

        {page?.view_type === 'cards' && (
          <Section title={t('taskDetail.exercise')}>
            <MetaEditor task={task} onSave={(meta) => save({ meta })} />
          </Section>
        )}

        {!isHabit && (
          <Section title={t('taskDetail.due')}>
            <View className="flex-row flex-wrap gap-2">
              <Chip
                label={t('taskDetail.today')}
                selected={task.due_date === today}
                onPress={() => save({ due_date: today })}
              />
              <Chip
                label={t('taskDetail.tomorrow')}
                selected={task.due_date === addDays(today, 1)}
                onPress={() => save({ due_date: addDays(today, 1) })}
              />
              <Chip
                label={t('taskDetail.nextWeek')}
                onPress={() => save({ due_date: addDays(today, 7) })}
              />
              <Chip
                label={t('taskDetail.noDate')}
                selected={!task.due_date}
                onPress={() => save({ due_date: null })}
              />
            </View>
            {task.due_date && (
              <Text className="font-mono text-xs text-ink-muted">
                {t('taskDetail.dueOn', { date: formatDueDate(task.due_date, today) })}
              </Text>
            )}
            <Input
              value={dateText}
              onChangeText={setDateText}
              onSubmitEditing={saveDateText}
              onBlur={saveDateText}
              editable={writable}
              placeholder={t('taskDetail.otherDatePlaceholder')}
              accessibilityLabel={t('taskDetail.otherDate')}
            />
          </Section>
        )}

        {!task.parent_task_id && task.habit_kind !== 'plusminus' && (
          <Section title={t('taskDetail.repeat')}>
            <RecurrenceEditor
              habit={isHabit}
              value={asRecurrence(task.recurrence)}
              onChange={(r) => save({ recurrence: r as Json })}
            />
            {!isHabit && asRecurrence(task.recurrence) && (
              <Text className="text-sm text-ink-muted">
                {t(
                  page?.reset_cycle !== 'none'
                    ? 'taskDetail.repeatCycle'
                    : task.due_date
                      ? 'taskDetail.repeatNext'
                      : 'taskDetail.repeatNextNoDate',
                )}
              </Text>
            )}
          </Section>
        )}

        <Section title={t('taskDetail.priority')}>
          <View className="flex-row flex-wrap gap-2">
            {PRIORITIES.map((p) => (
              <Chip
                key={p.value}
                label={t(p.label)}
                selected={task.priority === p.value}
                onPress={() => save({ priority: p.value })}
              />
            ))}
          </View>
        </Section>

        <Section title={t('taskDetail.labels')}>
          <Input
            value={labels}
            onChangeText={setLabels}
            onBlur={() => {
              const next = labels
                .split(/[\s,]+/)
                .map((l) => l.replace(/^#/, '').toLowerCase())
                .filter(Boolean);
              if (next.join() !== task.labels.join()) save({ labels: next });
            }}
            editable={writable}
            autoCapitalize="none"
            placeholder="#casa #mercado"
            accessibilityLabel={t('taskDetail.labels')}
          />
        </Section>

        {project && (
          <Section title={t('taskDetail.assignees')}>
            <AssigneesEditor task={task} />
          </Section>
        )}

        {!task.parent_task_id && <Subtasks task={task} />}

        {project && (
          <Section title={t('taskDetail.comments')}>
            <Comments task={task} />
          </Section>
        )}

        {!task.parent_task_id && (
          <Section title={t('taskDetail.page')}>
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-sm text-ink">{page ? pageLabel(page) : '…'}</Text>
              {writable && (
                <Button
                  variant="ghost"
                  icon={moving ? X : FolderInput}
                  label={moving ? t('common.close') : t('taskDetail.move')}
                  onPress={() => setMoving(!moving)}
                />
              )}
            </View>
            {moving && (
              <View className="flex-row flex-wrap gap-2">
                {tree.data?.pages
                  .filter((p) => p.id !== task.page_id)
                  .map((p) => (
                    <Chip
                      key={p.id}
                      label={pageLabel(p)}
                      onPress={() => {
                        save({ page_id: p.id, position: Date.now() });
                        setMoving(false);
                      }}
                    />
                  ))}
              </View>
            )}
          </Section>
        )}

        {update.error && (
          <Text className="text-sm text-danger">
            {t('taskDetail.saveError', { message: update.error.message })}
          </Text>
        )}

        {writable && (
          <Button
            variant="ghost"
            icon={Trash2}
            label={t('taskDetail.delete')}
            onPress={() => setConfirmDelete(true)}
            className="self-start"
          />
        )}

        {confirmDelete && (
          <ConfirmDialog
            title={t('taskDetail.deleteTitle')}
            message={task.parent_task_id ? undefined : t('taskDetail.deleteSubtasks')}
            confirmLabel={t('taskDetail.deleteConfirm')}
            onClose={closeConfirm}
            onConfirm={() => {
              remove.mutate(task.id);
              closeConfirm();
              router.back();
            }}
          />
        )}
      </Sheet>
    </WriteScope>
  );
}

function Subtasks({ task }: { task: Task }) {
  const writable = useCanWrite(task.folder_id);
  const pageTasks = usePageTasks(task.page_id);
  const create = useCreateSubtask();
  const toggle = useToggleWithUndo();
  const { t } = useTranslation();
  const [title, setTitle] = useState('');

  const subtasks = useMemo(
    () =>
      (pageTasks.data ?? [])
        .filter((t) => t.parent_task_id === task.id)
        .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)),
    [pageTasks.data, task.id],
  );

  function add() {
    const trimmed = title.trim();
    if (!trimmed) return;
    create.mutate({ parent: task, title: trimmed, id: uuidv7() });
    setTitle('');
  }

  return (
    <Section
      title={t('taskDetail.subtasks')}
      count={
        subtasks.length
          ? `${subtasks.filter((s) => s.status === 'done').length}/${subtasks.length}`
          : undefined
      }
    >
      {subtasks.map((s) => (
        <View key={s.id} className="-ml-3 flex-row items-center border-b border-line md:-ml-2">
          <Checkbox
            checked={s.status === 'done'}
            disabled={!writable}
            label={s.title}
            onChange={(checked) => toggle(s, checked)}
          />
          <Pressable
            className="min-h-11 flex-1 justify-center md:min-h-8"
            onPress={() => router.push({ pathname: '/task/[id]', params: { id: s.id } })}
          >
            <Text
              className={cn(
                'text-base text-ink md:text-sm',
                s.status === 'done' && 'text-ink-muted line-through',
              )}
            >
              {s.title}
            </Text>
          </Pressable>
        </View>
      ))}
      <Input
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={add}
        submitBehavior="submit"
        editable={writable}
        placeholder={t('taskDetail.newSubtaskPlaceholder')}
        accessibilityLabel={t('taskDetail.newSubtask')}
      />
      {create.error && <Text className="text-danger">{create.error.message}</Text>}
    </Section>
  );
}

/** Grupo do painel: rótulo de 12 px em caixa-alta (com contagem em mono) e o conteúdo. */
function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {title}
        </Text>
        {count && <Text className="font-mono text-xs text-ink-muted">{count}</Text>}
      </View>
      {children}
    </View>
  );
}

/** Escolha do painel: o Chip comum, desabilitado para quem não pode editar. */
function Chip(props: { label: string; selected?: boolean; onPress: () => void }) {
  const writable = useCanWrite();
  return <UiChip {...props} disabled={!writable} />;
}
