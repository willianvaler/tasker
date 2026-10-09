import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { useHabitDates } from '@/components/tasks/habit-row';
import { HabitHistory, MetaEditor, RecurrenceEditor } from '@/components/tasks/task-extras';
import { useToggleWithUndo } from '@/components/tasks/task-row';
import type { Json } from '@/lib/db';
import { asRecurrence } from '@/lib/recurrence';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
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
import { pageLabel, useTree } from '@/lib/queries/tree';
import { AssigneesEditor, Comments } from '@/components/tasks/task-collab';
import { rootFolder } from '@/lib/queries/projects';
import { useCanWrite, WriteScope } from '@/providers/write';

const PRIORITIES = [
  { value: 0, label: 'Nenhuma' },
  { value: 1, label: '! Baixa' },
  { value: 2, label: '!! Média' },
  { value: 3, label: '!!! Alta' },
];

// Detalhes da tarefa (gaveta/modal, nunca obrigatório): notas, prioridade, data, etiquetas,
// subtarefas, mover de página e apagar. Cada campo salva sozinho ao sair dele.
export default function TaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const task = useTask(id);

  if (task.isPending) return <Screen>{null}</Screen>;
  if (!task.data) {
    return (
      <Screen>
        <ScreenHeader title="Tarefa" back />
        <Text className="mt-6 text-muted-foreground">Essa tarefa não existe mais.</Text>
      </Screen>
    );
  }
  // Os campos começam com os valores da tarefa e salvam ao sair; key = id para reiniciar ao trocar de tarefa
  return <TaskDetails key={task.data.id} task={task.data} />;
}

function TaskDetails({ task }: { task: Task }) {
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
      <Screen>
        <ScreenHeader title={task.parent_task_id ? 'Subtarefa' : 'Tarefa'} back />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-5 pb-10">
          <View className="flex-row items-start">
            <Checkbox
              checked={done}
              disabled={!writable}
              label={done ? 'Reabrir' : 'Concluir'}
              onChange={(checked) => toggle(task, checked)}
            />
            <TextInput
              value={title}
              onChangeText={setTitle}
              onBlur={() =>
                title.trim() && title.trim() !== task.title && save({ title: title.trim() })
              }
              editable={writable}
              multiline
              maxLength={500}
              accessibilityLabel="Título"
              className={cn(
                'flex-1 py-2 text-xl font-semibold text-foreground',
                done && 'line-through',
              )}
            />
          </View>

          <Section title="Notas">
            <TextInput
              value={notes}
              onChangeText={setNotes}
              onBlur={() => notes !== (task.notes ?? '') && save({ notes: notes.trim() || null })}
              editable={writable}
              multiline
              placeholder="Detalhes, links, o que precisar…"
              placeholderTextColor="#94a3b8"
              accessibilityLabel="Notas"
              textAlignVertical="top"
              className="min-h-20 rounded-lg border border-border p-3 text-base text-foreground"
            />
          </Section>

          {isHabit && !task.parent_task_id && (
            <Section title="Histórico">
              <HabitHistory task={task} dates={habitDates.datesOf(task)} today={today} />
            </Section>
          )}

          {page?.view_type === 'cards' && (
            <Section title="Exercício">
              <MetaEditor task={task} onSave={(meta) => save({ meta })} />
            </Section>
          )}

          {!isHabit && (
            <Section title="Vencimento">
              <View className="flex-row flex-wrap gap-2">
                <Chip
                  label="Hoje"
                  selected={task.due_date === today}
                  onPress={() => save({ due_date: today })}
                />
                <Chip
                  label="Amanhã"
                  selected={task.due_date === addDays(today, 1)}
                  onPress={() => save({ due_date: addDays(today, 1) })}
                />
                <Chip
                  label="Daqui a 1 semana"
                  onPress={() => save({ due_date: addDays(today, 7) })}
                />
                <Chip
                  label="Sem data"
                  selected={!task.due_date}
                  onPress={() => save({ due_date: null })}
                />
              </View>
              {task.due_date && (
                <Text className="text-sm text-muted-foreground">
                  Vence: {formatDueDate(task.due_date, today)}
                </Text>
              )}
              <Input
                value={dateText}
                onChangeText={setDateText}
                onSubmitEditing={saveDateText}
                onBlur={saveDateText}
                editable={writable}
                placeholder="Outra data: sexta, 15/10, 15/10/2027…"
                accessibilityLabel="Outra data"
              />
            </Section>
          )}

          {!task.parent_task_id && (
            <Section title="Repetição">
              <RecurrenceEditor
                habit={isHabit}
                value={asRecurrence(task.recurrence)}
                onChange={(r) => save({ recurrence: r as Json })}
              />
              {!isHabit && asRecurrence(task.recurrence) && (
                <Text className="text-sm text-muted-foreground">
                  {page?.reset_cycle !== 'none'
                    ? 'Nesta página os checks reiniciam pelo ciclo da página.'
                    : task.due_date
                      ? 'Ao concluir, a data vai para a próxima vez.'
                      : 'Ao concluir, ganha a data da próxima vez.'}
                </Text>
              )}
            </Section>
          )}

          <Section title="Prioridade">
            <View className="flex-row flex-wrap gap-2">
              {PRIORITIES.map((p) => (
                <Chip
                  key={p.value}
                  label={p.label}
                  selected={task.priority === p.value}
                  onPress={() => save({ priority: p.value })}
                />
              ))}
            </View>
          </Section>

          <Section title="Etiquetas">
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
              accessibilityLabel="Etiquetas"
            />
          </Section>

          {project && (
            <Section title="Responsáveis">
              <AssigneesEditor task={task} />
            </Section>
          )}

          {!task.parent_task_id && <Subtasks task={task} />}

          {project && (
            <Section title="Comentários">
              <Comments task={task} />
            </Section>
          )}

          {!task.parent_task_id && (
            <Section title="Página">
              <Text className="text-foreground">{page ? pageLabel(page) : '…'}</Text>
              {writable && (
                <Button
                  variant="outline"
                  label={moving ? 'Fechar' : 'Mover para outra página'}
                  onPress={() => setMoving(!moving)}
                />
              )}
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
            <Text className="text-destructive">Não deu para salvar: {update.error.message}</Text>
          )}

          {writable && (
            <Button
              variant="ghost"
              label="🗑️ Apagar tarefa"
              onPress={() => setConfirmDelete(true)}
              className="self-start"
            />
          )}
        </ScrollView>

        {confirmDelete && (
          <ConfirmDialog
            title="Apagar a tarefa?"
            message={task.parent_task_id ? undefined : 'As subtarefas também serão apagadas.'}
            confirmLabel="Apagar"
            onClose={closeConfirm}
            onConfirm={() => {
              remove.mutate(task.id);
              closeConfirm();
              router.back();
            }}
          />
        )}
      </Screen>
    </WriteScope>
  );
}

function Subtasks({ task }: { task: Task }) {
  const writable = useCanWrite(task.folder_id);
  const pageTasks = usePageTasks(task.page_id);
  const create = useCreateSubtask();
  const toggle = useToggleWithUndo();
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
    create.mutate({ parent: task, title: trimmed, id: randomUUID() });
    setTitle('');
  }

  return (
    <Section
      title={`Subtarefas${subtasks.length ? ` (${subtasks.filter((s) => s.status === 'done').length}/${subtasks.length})` : ''}`}
    >
      {subtasks.map((s) => (
        <View key={s.id} className="flex-row items-center border-b border-border">
          <Checkbox
            checked={s.status === 'done'}
            disabled={!writable}
            label={s.title}
            onChange={(checked) => toggle(s, checked)}
          />
          <Pressable
            className="min-h-11 flex-1 justify-center"
            onPress={() => router.push({ pathname: '/task/[id]', params: { id: s.id } })}
          >
            <Text
              className={cn(
                'text-base text-foreground',
                s.status === 'done' && 'text-muted-foreground line-through',
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
        placeholder="Nova subtarefa… (Enter)"
        accessibilityLabel="Nova subtarefa"
      />
      {create.error && <Text className="text-destructive">{create.error.message}</Text>}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold uppercase text-muted-foreground">{title}</Text>
      {children}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const writable = useCanWrite();
  return (
    <Pressable
      accessibilityRole="button"
      aria-selected={selected}
      disabled={!writable}
      onPress={onPress}
      className={cn(
        'min-h-11 justify-center rounded-full border px-3',
        selected ? 'border-primary bg-primary' : 'border-border',
        !writable && 'opacity-50',
      )}
    >
      <Text className={selected ? 'text-primary-foreground' : 'text-foreground'}>{label}</Text>
    </Pressable>
  );
}
