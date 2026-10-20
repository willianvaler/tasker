import { uuidv7 } from '@/lib/uuid';
import { isTouchScreen } from '@/lib/touch';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronDown, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';

import { ItemIcon, type ItemKind } from '@/components/item-icon';
import { RepeatPlanEditor } from '@/components/tasks/repeat';
import { RecurrenceEditor } from '@/components/tasks/task-extras';
import { Button, IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Text, textClass } from '@/components/ui/text';
import { addDays, formatDueDate } from '@/lib/parser/dates';
import { parseQuickInput, type Priority, type Recurrence } from '@/lib/parser/quick';
import { getLastPageId, setLastPageId } from '@/lib/prefs';
import type { RepeatPlan } from '@/lib/repeat';
import { useToday } from '@/lib/queries/profile';
import { useCreateTasks, useUpdateTask } from '@/lib/queries/tasks';
import { isWorkoutPage, pageLabel, useTree } from '@/lib/queries/tree';
import { useColors } from '@/lib/tokens';
import { useShortcut } from '@/lib/use-shortcut';
import { useToast } from '@/providers/toast';

const PRIORITIES = [
  { value: 0, label: 'taskDetail.priorityNone' },
  { value: 1, label: 'taskDetail.priorityLow' },
  { value: 2, label: 'taskDetail.priorityMid' },
  { value: 3, label: 'taskDetail.priorityHigh' },
] as const;

export default function NewTaskScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const params = useLocalSearchParams<{ page?: string }>();
  const tree = useTree();
  const today = useToday();
  const create = useCreateTasks();
  const update = useUpdateTask();
  const toast = useToast();
  const [confirmDiscard, setConfirmDiscard, closeDiscard] = useDialog<true>();

  const pages = [
    ...[tree.data?.inbox, tree.data?.habits].filter((p) => !!p),
    ...(tree.data?.pages ?? []).filter((p) => !p.is_inbox && !p.is_habits),
  ];
  const [pageId, setPageId] = useState(params.page ?? getLastPageId() ?? null);
  const page = pages.find((p) => p.id === pageId) ?? tree.data?.inbox ?? undefined;
  // Página de treino (AC2, D234): séries e observação; data, prioridade e etiquetas em "Mais opções"
  const [more, setMore] = useState(false);
  const lean = !!page && isWorkoutPage(tree.data, page) && !more;

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [due, setDue] = useState<string | null>(null);
  const [dateText, setDateText] = useState('');
  const [priority, setPriority] = useState<Priority>(0);
  const [labels, setLabels] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null);
  const [repeatPlan, setRepeatPlan] = useState<RepeatPlan | null>(null);

  const dirty = !!(title.trim() || notes.trim() || labels.trim());
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const tryClose = () => (dirty ? setConfirmDiscard(true) : close());

  function save() {
    if (!title.trim() || !page) return false;
    const id = uuidv7();
    create.mutate({
      pageId: page.id,
      items: [
        {
          id,
          title: title.trim(),
          priority,
          dueDate: due,
          labels: labels
            .split(/[\s,]+/)
            .map((l) => l.replace(/^#/, '').toLowerCase())
            .filter(Boolean),
          recurrence,
          meta: null,
          repeatPlan,
          mentions: [],
          prereqs: [],
        },
      ],
    });
    // Notas não entram no create_tasks_batch: vão logo depois, na mesma fila
    if (notes.trim()) update.mutate({ id, patch: { notes: notes.trim() } });
    setLastPageId(page.id);
    toast({ message: t('advanced.created', { page: pageLabel(page) }) });
    router.replace({ pathname: '/task/[id]', params: { id } });
  }
  useShortcut('form.save', save);

  function saveDateText() {
    const parsed = parseQuickInput(`x ${dateText}`, { today });
    if (parsed.dueDate) {
      setDue(parsed.dueDate);
      setDateText('');
    }
  }

  return (
    <Sheet
      onClose={tryClose}
      header={
        <View className="min-h-12 flex-row items-center gap-2 border-b border-line pl-4 pr-2">
          <Text className="flex-1 font-mono text-xs uppercase text-ink-muted">
            {t('advanced.title')}
          </Text>
          <IconButton icon={X} label={t('common.close')} onPress={tryClose} />
        </View>
      }
    >
      <TextInput
        autoFocus={!isTouchScreen()}
        value={title}
        onChangeText={setTitle}
        placeholder={t('advanced.newTask')}
        placeholderTextColor={colors['ink-muted']}
        accessibilityLabel={t('taskDetail.titleField')}
        maxLength={500}
        className={textClass('min-h-11 text-lg font-semibold text-ink')}
      />

      <Field label={t('advanced.page')}>
        <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
          {pages.map((p) => (
            <Chip
              key={p.id}
              role="radio"
              label={pageLabel(p)}
              selected={p.id === page?.id}
              onPress={() => setPageId(p.id)}
            />
          ))}
        </View>
        {page && (
          <View className="flex-row items-center gap-2">
            <ItemIcon
              icon={page.is_inbox ? null : page.icon}
              kind={page.is_inbox ? 'inbox' : (page.view_type as ItemKind)}
            />
            <Text className="font-mono text-xs text-ink-muted">{pageLabel(page)}</Text>
          </View>
        )}
      </Field>

      <Field label={t('taskDetail.notes')}>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={10000}
          placeholder={t('taskDetail.notesPlaceholder')}
          placeholderTextColor={colors['ink-muted']}
          accessibilityLabel={t('taskDetail.notes')}
          textAlignVertical="top"
          className={textClass(
            'min-h-20 rounded border border-line bg-paper p-3 text-base text-ink focus:border-accent',
          )}
        />
      </Field>

      <Field label={t('repeat.section')}>
        <RepeatPlanEditor value={repeatPlan} onChange={setRepeatPlan} />
      </Field>

      {lean ? (
        <Button
          variant="ghost"
          icon={ChevronDown}
          className="self-start"
          label={t('gym.moreOptions')}
          onPress={() => setMore(true)}
        />
      ) : (
        <>
          <Field label={t('advanced.dueDate')}>
            <View className="flex-row flex-wrap gap-2">
              <Chip
                label={t('taskDetail.today')}
                selected={due === today}
                onPress={() => setDue(today)}
              />
              <Chip
                label={t('taskDetail.tomorrow')}
                selected={due === addDays(today, 1)}
                onPress={() => setDue(addDays(today, 1))}
              />
              <Chip label={t('taskDetail.nextWeek')} onPress={() => setDue(addDays(today, 7))} />
              <Chip label={t('taskDetail.noDate')} selected={!due} onPress={() => setDue(null)} />
            </View>
            {due && (
              <Text className="font-mono text-xs text-ink-muted">
                {t('taskDetail.dueOn', { date: formatDueDate(due, today) })}
              </Text>
            )}
            <Input
              value={dateText}
              onChangeText={setDateText}
              onSubmitEditing={saveDateText}
              onBlur={saveDateText}
              placeholder={t('taskDetail.otherDatePlaceholder')}
              accessibilityLabel={t('taskDetail.otherDate')}
            />
          </Field>

          <Field label={t('taskDetail.priority')}>
            <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
              {PRIORITIES.map((p) => (
                <Chip
                  key={p.value}
                  role="radio"
                  label={t(p.label)}
                  selected={priority === p.value}
                  onPress={() => setPriority(p.value)}
                />
              ))}
            </View>
          </Field>

          <Field label={t('taskDetail.repeat')}>
            <RecurrenceEditor value={recurrence} onChange={setRecurrence} />
          </Field>

          <Field label={t('taskDetail.labels')}>
            <Input
              value={labels}
              onChangeText={setLabels}
              autoCapitalize="none"
              placeholder="#casa #mercado"
              accessibilityLabel={t('taskDetail.labels')}
            />
          </Field>
        </>
      )}

      <View className="flex-row items-center gap-3">
        <Button label={t('advanced.save')} disabled={!title.trim() || !page} onPress={save} />
        <Text className="font-mono text-xs text-ink-muted">{t('advanced.saveHint')}</Text>
      </View>

      {confirmDiscard && (
        <ConfirmDialog
          title={t('advanced.discardTitle')}
          message={t('advanced.discardMessage')}
          confirmLabel={t('advanced.discard')}
          destructive
          onClose={closeDiscard}
          onConfirm={() => {
            closeDiscard();
            close();
          }}
        />
      )}
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</Text>
      {children}
    </View>
  );
}
