import { Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import { cn } from '@/lib/cn';
import { addDays, startOfIsoWeek, type IsoDate } from '@/lib/parser/dates';
import type { Recurrence, SetGroup, TaskMeta } from '@/lib/parser/quick';
import type { Json } from '@/lib/db';
import type { Task } from '@/lib/queries/tasks';
import { asRecurrence, habitStreak, isHabitDueOn, recurrenceLabel } from '@/lib/recurrence';
import { readRepeatPlan } from '@/lib/repeat';
import { formatRest, parseRest, planFromSets, setGroups } from '@/lib/workout';
import { useCanWrite } from '@/providers/write';

// Ordem de exibição: segunda primeiro
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Nomes dos dias no idioma da tela (0 = domingo), a partir de um domingo qualquer. */
function weekdayNames(locale: string, width: 'narrow' | 'short') {
  const format = new Intl.DateTimeFormat(locale, { weekday: width, timeZone: 'UTC' });
  return Array.from({ length: 7 }, (_, d) =>
    format.format(new Date(Date.UTC(2024, 0, 7 + d))).replace('.', ''),
  );
}

/** Escolha da repetição: nenhuma, diária, semanal, mensal ou dias da semana. */
export function RecurrenceEditor({
  value,
  habit,
  onChange,
}: {
  value: Recurrence | null;
  /** Hábito: "nenhuma" não existe (o padrão é todo dia) */
  habit?: boolean;
  onChange: (r: Recurrence | null) => void;
}) {
  const { t, i18n } = useTranslation();
  const dayNames = weekdayNames(i18n.language, 'short');
  const writable = useCanWrite();
  const type = value?.type ?? (habit ? 'daily' : null);
  const days = value?.type === 'weekdays' ? value.days : [];
  const options: { label: string; value: Recurrence | null; selected: boolean }[] = [
    ...(habit ? [] : [{ label: t('extras.noRepeat'), value: null, selected: type === null }]),
    { label: t('extras.daily'), value: { type: 'daily' }, selected: type === 'daily' },
    { label: t('extras.weekly'), value: { type: 'weekly' }, selected: type === 'weekly' },
    { label: t('extras.monthly'), value: { type: 'monthly' }, selected: type === 'monthly' },
    {
      label: t('extras.weekdays'),
      value: { type: 'weekdays', days: [1, 3, 5] },
      selected: type === 'weekdays',
    },
  ];

  function toggleDay(day: number) {
    const next = days.includes(day)
      ? days.filter((d) => d !== day)
      : [...days, day].sort((a, b) => a - b);
    // Pelo menos um dia
    if (next.length) onChange({ type: 'weekdays', days: next });
  }

  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-2">
        {options.map((o) => (
          <Chip
            key={o.label}
            role="radio"
            label={o.label}
            selected={o.selected}
            disabled={!writable}
            onPress={() => !o.selected && onChange(o.value)}
          />
        ))}
      </View>
      {type === 'weekdays' && (
        <View className="flex-row flex-wrap gap-2">
          {WEEK_ORDER.map((d) => (
            <Chip
              key={d}
              role="checkbox"
              label={dayNames[d]}
              selected={days.includes(d)}
              disabled={!writable}
              onPress={() => toggleDay(d)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

type GroupRow = { sets: string; reps: string; weight: string };
const toRow = (g: { sets?: number; reps?: number; weight?: string }): GroupRow => ({
  sets: g.sets?.toString() ?? '',
  reps: g.reps?.toString() ?? '',
  weight: g.weight ?? '',
});

/**
 * Séries, repetições, carga e descanso (página de treino). Salva ao sair de cada campo. As séries
 * e o descanso vão também para o plano do Modo Treino (`repeat_plan`): é ele que conta as séries e
 * começa o descanso, com o aviso na tela de bloqueio no fim.
 *
 * **Séries avançadas** (19/10): a mesma linha, com um "+" no fim que acrescenta outra linha de
 * séries com repetições e carga próprias ("1 de 14, 2 de 10, 1 de 8"). Ficam em `meta.groups`; o
 * plano conta a soma, e o Modo Treino mostra o que cada série pede.
 */
export function MetaEditor({
  task,
  onSave,
}: {
  task: Task;
  onSave: (patch: { meta: Json; repeat_plan: Json }) => void;
}) {
  const { t } = useTranslation();
  const writable = useCanWrite();
  const meta = (task.meta && typeof task.meta === 'object' ? task.meta : {}) as TaskMeta;
  const plan = readRepeatPlan(task.repeat_plan);
  const setsPlan = plan?.mode === 'sets' ? plan : null;
  const savedGroups = setGroups(meta);
  const [advanced, setAdvanced] = useState(savedGroups.length > 0);
  const [rows, setRows] = useState<GroupRow[]>(() =>
    savedGroups.length
      ? savedGroups.map(toRow)
      : [toRow({ sets: setsPlan?.total ?? meta.sets, reps: meta.reps, weight: meta.weight })],
  );
  const [rest, setRest] = useState(formatRest(setsPlan?.rest_seconds));

  function save(nextRows = rows, nextAdvanced = advanced) {
    const groups: SetGroup[] = nextRows
      .map((row) => ({
        sets: parseInt(row.sets, 10),
        reps: parseInt(row.reps, 10),
        weight: row.weight.trim(),
      }))
      .filter((g) => g.sets > 0)
      .map((g) => ({
        sets: g.sets,
        ...(g.reps > 0 ? { reps: g.reps } : {}),
        ...(g.weight ? { weight: g.weight } : {}),
      }));
    const first = nextRows[0];
    const r = parseInt(first.reps, 10);
    const s = nextAdvanced ? groups.reduce((sum, g) => sum + g.sets, 0) : parseInt(first.sets, 10);
    const next: TaskMeta = {};
    if (s > 0) next.sets = s;
    if (r > 0) next.reps = r;
    if (first.weight.trim()) next.weight = first.weight.trim();
    if (nextAdvanced && groups.length) next.groups = groups;
    const restSeconds = parseRest(rest);
    const nextPlan = planFromSets(plan, s > 0 ? s : null, restSeconds);
    // Volta o texto ao que foi entendido ("90" → "1:30"; vazio com séries → o padrão)
    setRest(formatRest(nextPlan?.mode === 'sets' ? nextPlan.rest_seconds : null));
    if (
      JSON.stringify(next) !== JSON.stringify(meta) ||
      JSON.stringify(nextPlan) !== JSON.stringify(plan)
    )
      onSave({
        meta: Object.keys(next).length ? next : null,
        repeat_plan: nextPlan as Json,
      });
  }

  const setRow = (i: number, field: keyof GroupRow, value: string) =>
    setRows((list) => list.map((row, j) => (j === i ? { ...row, [field]: value } : row)));

  function toggleAdvanced(on: boolean) {
    // Desligar fica com a primeira linha
    const next = on ? rows : rows.slice(0, 1);
    setAdvanced(on);
    setRows(next);
    save(next, on);
  }

  function addRow() {
    // A linha nova começa como a última (1 série, mesmas repetições e carga), para só ajustar
    const last = rows[rows.length - 1];
    const next = [...rows, { ...last, sets: '1' }];
    setRows(next);
    save(next);
  }

  function removeRow(i: number) {
    const next = rows.filter((_, j) => j !== i);
    setRows(next);
    save(next);
  }

  const field = (
    i: number,
    label: string,
    value: string,
    onChange: (v: string) => void,
    kind: 'number' | 'weight' | 'rest',
  ) => (
    <View key={label} className="min-w-0 flex-1 gap-1">
      {i === 0 && <Text className="text-xs text-ink-muted">{label}</Text>}
      <Input
        value={value}
        onChangeText={onChange}
        onBlur={() => save()}
        onSubmitEditing={() => save()}
        editable={writable}
        keyboardType={kind === 'number' ? 'number-pad' : 'default'}
        placeholder={kind === 'number' ? '0' : kind === 'weight' ? '20kg' : '1:00'}
        accessibilityLabel={i === 0 ? label : `${label} ${i + 1}`}
        maxLength={kind === 'number' ? 4 : kind === 'rest' ? 6 : 20}
        className="font-mono"
      />
    </View>
  );

  return (
    <View className="gap-2">
      {rows.map((row, i) => (
        <View key={i} className="flex-row items-end gap-2">
          {field(i, t('extras.sets'), row.sets, (v) => setRow(i, 'sets', v), 'number')}
          {field(i, t('extras.reps'), row.reps, (v) => setRow(i, 'reps', v), 'number')}
          {field(i, t('extras.weight'), row.weight, (v) => setRow(i, 'weight', v), 'weight')}
          {i === 0 ? (
            field(i, t('extras.rest'), rest, setRest, 'rest')
          ) : (
            // O descanso é um só; nas outras linhas o lugar dele é o "tirar"
            <View className="min-w-0 flex-1 items-start">
              <IconButton
                tone="danger"
                icon={X}
                label={t('extras.removeGroup')}
                disabled={!writable}
                onPress={() => removeRow(i)}
              />
            </View>
          )}
          {advanced &&
            (i === rows.length - 1 ? (
              <IconButton
                icon={Plus}
                label={t('extras.addGroup')}
                disabled={!writable || rows.length >= MAX_GROUPS}
                onPress={addRow}
              />
            ) : (
              <View className="w-11 md:w-8" />
            ))}
        </View>
      ))}
      <ToggleRow
        title={t('extras.advancedSets')}
        hint={t('extras.advancedHint')}
        value={advanced}
        disabled={!writable}
        onChange={toggleAdvanced}
      />
    </View>
  );
}

/** Linhas de séries avançadas por exercício (mais que isso não é um treino de verdade). */
const MAX_GROUPS = 10;

/** Sequência e calendário das últimas 5 semanas de um hábito. */
export function HabitHistory({
  task,
  dates,
  today,
}: {
  task: Task;
  dates: IsoDate[];
  today: IsoDate;
}) {
  const { t, i18n } = useTranslation();
  const letters = weekdayNames(i18n.language, 'narrow');
  const r = asRecurrence(task.recurrence);
  const done = new Set(dates);
  const streak = habitStreak(r, dates, today);
  const firstMonday = addDays(startOfIsoWeek(today), -28);
  const weeks = Array.from({ length: 5 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(firstMonday, w * 7 + d)),
  );
  const last30 = Array.from({ length: 30 }, (_, i) => addDays(today, -i)).filter((d) =>
    done.has(d),
  ).length;

  return (
    <View className="gap-3">
      <View className="flex-row gap-6">
        <Stat
          value={String(streak)}
          label={t(
            r?.type === 'weekly'
              ? 'extras.streakWeeks'
              : r?.type === 'monthly'
                ? 'extras.streakMonths'
                : 'extras.streakDays',
          )}
        />
        <Stat value={String(last30)} label={t('extras.last30')} />
        <Stat value={recurrenceLabel(r) || t('extras.daily')} label={t('extras.frequency')} />
      </View>
      <View className="gap-1 self-start" accessibilityLabel={t('extras.calendar')}>
        <View className="flex-row gap-1">
          {WEEK_ORDER.map((d) => (
            <Text key={d} className="w-8 text-center font-mono text-xs text-ink-muted">
              {letters[d]}
            </Text>
          ))}
        </View>
        {weeks.map((week) => (
          <View key={week[0]} className="flex-row gap-1">
            {week.map((day) => (
              <View
                key={day}
                accessibilityLabel={t(done.has(day) ? 'extras.dayDone' : 'extras.dayNotDone', {
                  day,
                })}
                className={cn(
                  'h-8 w-8 items-center justify-center rounded',
                  day > today
                    ? 'opacity-0'
                    : done.has(day)
                      ? 'bg-accent'
                      : isHabitDueOn(r, day)
                        ? 'border border-line'
                        : 'bg-wash',
                  day === today && !done.has(day) && 'border-2 border-accent',
                )}
              >
                <Text
                  className={cn(
                    'font-mono text-xs',
                    done.has(day) ? 'text-on-accent' : 'text-ink-muted',
                  )}
                >
                  {Number(day.slice(8))}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View>
      <Text className="font-mono text-base text-ink">{value}</Text>
      <Text className="text-xs text-ink-muted">{label}</Text>
    </View>
  );
}

const HABIT_KINDS = [
  { value: 'check', label: 'extras.kindCheck', hint: 'extras.hintCheck' },
  { value: 'counter', label: 'extras.kindCounter', hint: 'extras.hintCounter' },
  { value: 'plusminus', label: 'extras.kindPlusminus', hint: 'extras.hintPlusminus' },
] as const satisfies readonly { value: Task['habit_kind']; label: string; hint: string }[];

/** Tipo do hábito: marcar, contador com meta ou bom/ruim (+/−). */
export function HabitKindEditor({
  task,
  onSave,
}: {
  task: Task;
  onSave: (patch: Partial<Pick<Task, 'habit_kind' | 'habit_target' | 'habit_sides'>>) => void;
}) {
  const { t } = useTranslation();
  const writable = useCanWrite();
  const [target, setTarget] = useState(String(task.habit_target ?? 8));
  const current = HABIT_KINDS.find((k) => k.value === task.habit_kind) ?? HABIT_KINDS[0];

  function saveTarget() {
    const n = Math.min(100, Math.max(1, Math.round(Number(target)) || 1));
    setTarget(String(n));
    if (n !== task.habit_target) onSave({ habit_kind: 'counter', habit_target: n });
  }

  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {HABIT_KINDS.map((k) => (
          <Chip
            key={k.value}
            role="radio"
            label={t(k.label)}
            selected={task.habit_kind === k.value}
            disabled={!writable}
            onPress={() =>
              onSave({
                habit_kind: k.value,
                habit_target: k.value === 'counter' ? Number(target) || 8 : null,
              })
            }
          />
        ))}
      </View>
      <Text className="text-sm text-ink-muted">{t(current.hint)}</Text>
      {task.habit_kind === 'plusminus' && (
        <View className="gap-2">
          <View
            className="flex-row flex-wrap gap-2"
            accessibilityRole="radiogroup"
            accessibilityLabel={t('habit.sides.label')}
          >
            {(['both', 'up', 'down'] as const).map((side) => (
              <Chip
                key={side}
                role="radio"
                label={t(`habit.sides.${side}`)}
                selected={(task.habit_sides ?? 'both') === side}
                disabled={!writable}
                onPress={() => onSave({ habit_sides: side })}
              />
            ))}
          </View>
          <Text className="text-sm text-ink-muted">{t('habit.sides.hint')}</Text>
        </View>
      )}
      {task.habit_kind === 'counter' && (
        <View className="flex-row items-center gap-2">
          <Text className="text-sm text-ink-muted">{t('extras.target')}</Text>
          <Input
            value={target}
            onChangeText={(text) => setTarget(text.replace(/\D/g, ''))}
            onBlur={saveTarget}
            onSubmitEditing={saveTarget}
            keyboardType="number-pad"
            editable={writable}
            className="w-20 font-mono"
            accessibilityLabel={t('extras.target')}
          />
        </View>
      )}
    </View>
  );
}
