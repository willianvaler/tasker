import { uuidv7 } from '@/lib/uuid';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronDown, FolderInput, Plus, Trash2, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import { useHabitDates } from '@/components/tasks/habit-row';
import {
  HabitHistory,
  HabitKindEditor,
  MetaEditor,
  RecurrenceEditor,
} from '@/components/tasks/task-extras';
import { TaskFields } from '@/components/fields';
import { useMyDayToggle } from '@/components/my-day';
import { ReceivedNote } from '@/components/received';
import { RepeatCounter, RepeatPlanEditor } from '@/components/tasks/repeat';
import { ApprovalEditor } from '@/components/tasks/assignee-chips';
import { TaskTime } from '@/components/tasks/task-time';
import { useToggleWithUndo } from '@/components/tasks/task-row';
import { Icon } from '@/components/ui/icon';
import { Text, textClass } from '@/components/ui/text';
import type { Json } from '@/lib/db';
import { asRecurrence } from '@/lib/recurrence';
import { showSection, usedSections, type AdvancedSection } from '@/lib/panel-sections';
import { getPanelMode, setPanelMode, type PanelMode } from '@/lib/prefs';
import { readRepeatPlan } from '@/lib/repeat';
import { Button, IconButton } from '@/components/ui/button';
import { ConflictNotice } from '@/components/tasks/conflict-notice';
import { Checkbox } from '@/components/ui/checkbox';
import { Chip as UiChip } from '@/components/ui/chip';
import { ActionMenu, ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/cn';
import { useColors } from '@/lib/tokens';
import { addDays, formatDueDate } from '@/lib/parser/dates';
import { parseQuickInput } from '@/lib/parser/quick';
import { useToday } from '@/lib/queries/profile';
import { DependencyEditor } from '@/components/tasks/dependency-editor';
import { useForceTask, useStartTask, useTaskFlow } from '@/lib/queries/dependencies';
import {
  dueAfterParent,
  formatDuration,
  leafActuals,
  leafWeightedProgress,
  leafEstimates,
  leafProgress,
  parseDuration,
} from '@/lib/task-tree';
import {
  useCompleteTree,
  useCreateSubtask,
  useDeleteTask,
  usePageTasks,
  useTask,
  useUpdateTask,
  type Task,
  type TaskPatch,
} from '@/lib/queries/tasks';
import { findFolder, isWorkoutPage, pageLabel, useTree } from '@/lib/queries/tree';
import { AssigneesEditor, Comments } from '@/components/tasks/task-collab';
import { Attachments } from '@/components/tasks/attachments';
import { TaskHistory } from '@/components/tasks/task-history';
import { Related } from '@/components/related';
import { rootFolder } from '@/lib/queries/projects';
import { usePageFields } from '@/lib/queries/fields';
import { useIsReceived } from '@/lib/queries/shares';
import { useToast } from '@/providers/toast';
import { useCanWrite, useTaskCan, WriteScope } from '@/providers/write';

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
/** "#casa, #Mercado" → ['casa', 'mercado'] */
const parseLabelsText = (text: string) =>
  text
    .split(/[\s,]+/)
    .map((l) => l.replace(/^#/, '').toLowerCase())
    .filter(Boolean);

/** Descrição da tarefa (W4): o mesmo limite do banco (tasks_notes_check) */
const NOTES_MAX = 10000;

function PanelHeader({
  path,
  mode,
  onMode,
}: {
  path: string;
  mode?: PanelMode;
  onMode?: (mode: PanelMode) => void;
}) {
  const { t } = useTranslation();
  const [menu, setMenu, closeMenu] = useDialog<true>();
  return (
    <View className="min-h-12 flex-row items-center gap-2 border-b border-line pl-4 pr-2">
      <Text className="flex-1 font-mono text-xs uppercase text-ink-muted" numberOfLines={1}>
        {path}
      </Text>
      {mode && onMode && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('panelMode.label', { mode: t(`panelMode.${mode}`) })}
          onPress={() => setMenu(true)}
          className="h-11 flex-row items-center gap-1 rounded px-2 hover:bg-wash md:h-8"
        >
          <Text className="text-sm text-ink-muted">{t(`panelMode.${mode}`)}</Text>
          <Icon icon={ChevronDown} tone="ink-muted" />
        </Pressable>
      )}
      <IconButton icon={X} label={t('common.back')} onPress={close} />
      {menu && onMode && (
        <ActionMenu
          title={t('panelMode.title')}
          onClose={closeMenu}
          actions={(['simple', 'full'] as const).map((value) => ({
            label: `${value === mode ? '✓ ' : ''}${t(`panelMode.${value}`)} · ${t(`panelMode.${value}Hint`)}`,
            onPress: () => onMode(value),
          }))}
        />
      )}
    </View>
  );
}

function TaskDetails({ task }: { task: Task }) {
  const { t } = useTranslation();
  const colors = useColors();
  const today = useToday();
  const allowed = useTaskCan(task);
  // Item de página recebida (L): o aluno deixa observação para quem enviou
  const received = useIsReceived(task.page_id);
  const myDay = useMyDayToggle(today);
  // Painel simples × completo (U2): o avançado só aparece no completo ou se a tarefa já usa
  const [mode, setMode] = useState<PanelMode>(getPanelMode);
  const changeMode = (value: PanelMode) => {
    setPanelMode(value);
    setMode(value);
  };
  // Colaborador: só mexe no que criou ou no que é dele (o resto fica só de leitura)
  const writable = useCanWrite(task.folder_id) && allowed.edit;
  const tree = useTree();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const toggle = useToggleWithUndo();
  const completeTree = useCompleteTree();
  const [confirmDelete, setConfirmDelete, closeConfirm] = useDialog<true>();
  const [confirmAll, setConfirmAll, closeConfirmAll] = useDialog<true>();
  const siblings = usePageTasks(task.page_id);
  const leaves = leafProgress(siblings.data ?? []).get(task.id);
  const openLeaves = leaves ? leaves.total - leaves.done : 0;
  const parent = siblings.data?.find((s) => s.id === task.parent_task_id);
  // Fluxo: bloqueada (estrito) não inicia nem conclui; no flexível, quem pode, força
  const flow = useTaskFlow(task);
  const used = usedSections(task, {
    dependencies: flow.dependsOn.length + flow.unlocks.length,
    inMyDay: myDay.has(task.id),
  });
  const show = (section: AdvancedSection) => showSection(mode, used, section);
  const start = useStartTask();
  const force = useForceTask();
  const [confirmForce, setConfirmForce, closeConfirmForce] = useDialog<'start' | 'complete'>();
  const blocked = flow.state === 'blocked';
  // L na lista abre o painel já no "Depende de"
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const depsRef = useRef<TextInput>(null);
  useEffect(() => {
    if (focus === 'deps') setTimeout(() => depsRef.current?.focus(), 150);
  }, [focus]);
  const toast = useToast();
  const flowError = (err: Error) => toast({ message: err.message });
  // Mãe: a estimativa é a soma das folhas (só leitura)
  const rollup = leaves ? leafEstimates(siblings.data ?? []).get(task.id) : undefined;
  const [estimateText, setEstimateText] = useState(
    task.estimate_minutes ? formatDuration(task.estimate_minutes) : '',
  );
  function saveEstimate() {
    const minutes = estimateText.trim() ? parseDuration(estimateText) : null;
    if (minutes === null && estimateText.trim())
      return setEstimateText(task.estimate_minutes ? formatDuration(task.estimate_minutes) : '');
    if (minutes !== task.estimate_minutes) save({ estimate_minutes: minutes });
    setEstimateText(minutes ? formatDuration(minutes) : '');
  }

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? '');
  const [showNotes, setShowNotes] = useState(false);
  const [labels, setLabels] = useState(task.labels.map((l) => `#${l}`).join(' '));
  const [dateText, setDateText] = useState('');
  const [moving, setMoving] = useState(false);

  const save = (patch: TaskPatch) => update.mutate({ id: task.id, patch });

  // W6: fechar o painel (clicar fora, X, Esc) salva o que estava sendo editado, sem depender do
  // campo perder o foco. O ref guarda a versão mais nova (a limpeza roda depois da última tela)
  const flush = useRef<() => void>(() => {});
  useEffect(() => {
    flush.current = () => {
      if (!writable) return;
      const patch: TaskPatch = {};
      if (title.trim() && title.trim() !== task.title) patch.title = title.trim();
      if (notes !== (task.notes ?? '')) patch.notes = notes.trim() || null;
      const nextLabels = parseLabelsText(labels);
      if (nextLabels.join() !== task.labels.join()) patch.labels = nextLabels;
      if (Object.keys(patch).length) update.mutate({ id: task.id, patch });
    };
  });
  useEffect(() => () => flush.current(), []);
  const done = task.status === 'done';
  const page = tree.data?.pages.find((p) => p.id === task.page_id);
  const place = page ? findFolder(tree.data, page.folder_id) : null;
  const isHabit = page?.view_type === 'habits';
  // Exercício: séries, repetições, carga e descanso; sem pomodoro, cronômetro nem plano à parte
  const isWorkout = !!page && isWorkoutPage(tree.data, page);
  const repeatPlan = readRepeatPlan(task.repeat_plan);
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
    <WriteScope folderId={task.folder_id} readOnly={!allowed.edit}>
      <Sheet
        onClose={close}
        header={
          <PanelHeader
            mode={mode}
            onMode={changeMode}
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
              disabled={!allowed.complete || (blocked && !flow.forceable)}
              label={t(done ? 'taskDetail.reopen' : 'taskDetail.complete')}
              onChange={(checked) =>
                checked && blocked
                  ? setConfirmForce('complete')
                  : checked && openLeaves > 0
                    ? setConfirmAll(true)
                    : toggle(task, checked)
              }
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

        {/* Y2 (#2): "Iniciar" sozinho numa tarefa comum confundia: no Simples, só em projeto, com
            dependência ou com a tarefa já em andamento */}
        {!done && !isHabit && (mode === 'full' || project || blocked || flow.state === 'doing') && (
          <View className="flex-row flex-wrap items-center gap-2">
            {blocked ? (
              <Text className="flex-1 text-sm text-ink-muted">
                {t('flow.blocked', { names: flow.waiting.join(', ') })}
              </Text>
            ) : flow.state === 'doing' ? (
              <Text className="flex-1 text-sm text-accent">{t('flow.doing')}</Text>
            ) : (
              <View className="flex-1" />
            )}
            {allowed.complete && (!blocked || flow.forceable) && (
              <Button
                variant="ghost"
                label={t(flow.state === 'doing' ? 'task.stop' : 'task.start')}
                onPress={() =>
                  blocked
                    ? setConfirmForce('start')
                    : start.mutate(
                        { id: task.id, started: flow.state !== 'doing' },
                        { onError: flowError },
                      )
                }
              />
            )}
          </View>
        )}

        {project && !isHabit && show('dependencies') && (
          <DependencyEditor
            task={task}
            dependsOn={flow.dependsOn}
            unlocks={flow.unlocks}
            titleOf={flow.titleOf}
            inputRef={depsRef}
          />
        )}

        {/* W4: descrição vazia é só um botão; aberta, até 4.000 caracteres */}
        {!notes && !showNotes ? (
          writable && (
            <Button
              variant="ghost"
              icon={Plus}
              label={t('taskDetail.addDescription')}
              className="self-start"
              onPress={() => setShowNotes(true)}
            />
          )
        ) : (
          <Section
            title={t('taskDetail.notes')}
            count={notes.length > NOTES_MAX * 0.8 ? `${notes.length}/${NOTES_MAX}` : undefined}
          >
            <TextInput
              value={notes}
              onChangeText={setNotes}
              onBlur={() => notes !== (task.notes ?? '') && save({ notes: notes.trim() || null })}
              editable={writable}
              autoFocus={showNotes && !task.notes}
              maxLength={NOTES_MAX}
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
        )}

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

        {isWorkout && !leaves && (
          <Section title={t('taskDetail.exercise')}>
            <MetaEditor task={task} onSave={save} />
            {repeatPlan?.mode === 'sets' && (
              <RepeatCounter
                task={task}
                disabled={!allowed.complete || (blocked && !flow.forceable)}
              />
            )}
          </Section>
        )}

        {received && (
          <Section title={t('received.noteTitle')}>
            <ReceivedNote task={task} />
          </Section>
        )}

        {show('fields') && (
          <PanelFields task={task} disabled={!writable} title={t('fields.section')} />
        )}

        {!isHabit &&
          !received &&
          show('approval') &&
          rootFolder(tree.data, task.folder_id)?.kind === 'project' && (
            <Section title={t('approval.title')}>
              <ApprovalEditor task={task} disabled={!writable} onChange={(patch) => save(patch)} />
            </Section>
          )}

        {!isHabit && !received && task.status !== 'done' && show('myDay') && (
          <Section title={t('myDay.title')}>
            <Chip
              label={t(myDay.has(task.id) ? 'myDay.inDay' : 'myDay.add')}
              selected={myDay.has(task.id)}
              onPress={() => myDay.toggle(task.id)}
            />
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
            {parent?.due_date && dueAfterParent(task.due_date, parent.due_date) && (
              <Text className="text-xs text-warn">
                {t('taskDetail.afterParent', { date: formatDueDate(parent.due_date, today) })}
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

        {!isHabit && !isWorkout && (show('time') || !!leaves) && (
          <Section title={t('taskDetail.time')}>
            {leaves ? (
              <Text className="text-sm text-ink">
                {rollup
                  ? t('taskDetail.estimateRollup', { time: formatDuration(rollup) })
                  : t('taskDetail.estimateNone')}
              </Text>
            ) : (
              <Input
                value={estimateText}
                onChangeText={setEstimateText}
                onSubmitEditing={saveEstimate}
                onBlur={saveEstimate}
                editable={writable}
                placeholder={t('taskDetail.estimatePlaceholder')}
                accessibilityLabel={t('taskDetail.estimate')}
              />
            )}
            {leaves ? (
              <Text className="text-sm text-ink">
                {t('time.rollup', {
                  done: formatDuration(leafActuals(siblings.data ?? []).get(task.id) ?? 0),
                })}
              </Text>
            ) : (
              <TaskTime task={task} disabled={!allowed.complete || (blocked && !flow.forceable)} />
            )}
          </Section>
        )}

        {!isHabit &&
          !leaves &&
          show('repeat') &&
          // No treino, as séries ficam em Exercício; contador e cronometrado seguem aqui
          (!isWorkout || (repeatPlan && repeatPlan.mode !== 'sets')) && (
            <Section title={t('repeat.section')}>
              <RepeatCounter
                task={task}
                disabled={!allowed.complete || (blocked && !flow.forceable)}
              />
              <RepeatPlanEditor
                value={readRepeatPlan(task.repeat_plan)}
                onChange={(plan) => save({ repeat_plan: plan as Json })}
                disabled={!writable}
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

        {!isHabit && show('weight') && (
          <Section title={t('weight.title')}>
            {leaves ? (
              <Text className="text-sm text-ink">
                {t('weight.progress', {
                  pct: leafWeightedProgress(siblings.data ?? []).get(task.id) ?? 0,
                })}
              </Text>
            ) : (
              <>
                <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
                  {[1, 2, 3, 4, 5].map((w) => (
                    <Chip
                      key={w}
                      label={String(w)}
                      selected={(task.weight ?? 1) === w}
                      onPress={() => save({ weight: w === 1 ? null : w })}
                    />
                  ))}
                </View>
                <Text className="text-xs text-ink-muted">{t('weight.hint')}</Text>
              </>
            )}
          </Section>
        )}

        <Section title={t('taskDetail.labels')}>
          <Input
            value={labels}
            onChangeText={setLabels}
            onBlur={() => {
              const next = parseLabelsText(labels);
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

        <Section title={t('attach.section')}>
          <Attachments task={task} writable={allowed.edit} />
        </Section>

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

        {show('extras') && <Related type="task" id={task.id} editable={writable} />}

        {show('extras') && <TaskHistory taskId={task.id} folderId={task.folder_id} />}

        {mode === 'simple' && (
          <Button
            variant="ghost"
            icon={ChevronDown}
            label={t('panelMode.showAll')}
            onPress={() => changeMode('full')}
            className="self-start"
          />
        )}

        {update.error && (
          <Text className="text-sm text-danger">
            {t('taskDetail.saveError', { message: update.error.message })}
          </Text>
        )}

        {allowed.delete && (
          <Button
            variant="ghost"
            icon={Trash2}
            label={t('taskDetail.delete')}
            onPress={() => setConfirmDelete(true)}
            className="self-start"
          />
        )}

        {confirmForce && (
          <ConfirmDialog
            title={t('flow.forceTitle', { title: task.title })}
            message={t('flow.forceMessage', { names: flow.waiting.join(', ') })}
            confirmLabel={t('flow.force')}
            onClose={closeConfirmForce}
            onConfirm={() => {
              const action = confirmForce;
              closeConfirmForce();
              force.mutate({ id: task.id, action }, { onError: flowError });
            }}
          />
        )}
        {confirmAll && (
          <ConfirmDialog
            title={t('task.completeAllTitle', { title: task.title })}
            message={t('task.completeAllMessage', { count: openLeaves })}
            confirmLabel={t('task.completeAll')}
            onClose={closeConfirmAll}
            onConfirm={() => {
              closeConfirmAll();
              completeTree.mutate(task.id);
            }}
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

/** Campos personalizados da página (M5): só aparecem se a página tem algum. */
function PanelFields({ task, disabled, title }: { task: Task; disabled: boolean; title: string }) {
  const fields = usePageFields(task.page_id);
  if (!fields.data?.length) return null;
  return (
    <Section title={title}>
      <TaskFields task={task} disabled={disabled} />
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
