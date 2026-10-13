import { useState } from 'react';
import { Text, View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { addDays, startOfIsoWeek, type IsoDate } from '@/lib/parser/dates';
import type { Recurrence, TaskMeta } from '@/lib/parser/quick';
import type { Json } from '@/lib/db';
import type { Task } from '@/lib/queries/tasks';
import { asRecurrence, habitStreak, isHabitDueOn, recurrenceLabel } from '@/lib/recurrence';
import { useCanWrite } from '@/providers/write';

const DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const DAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
// Ordem de exibição: segunda primeiro
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

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
  const writable = useCanWrite();
  const type = value?.type ?? (habit ? 'daily' : null);
  const days = value?.type === 'weekdays' ? value.days : [];
  const options: { label: string; value: Recurrence | null; selected: boolean }[] = [
    ...(habit ? [] : [{ label: 'Não repete', value: null, selected: type === null }]),
    { label: 'Todo dia', value: { type: 'daily' }, selected: type === 'daily' },
    { label: 'Toda semana', value: { type: 'weekly' }, selected: type === 'weekly' },
    { label: 'Todo mês', value: { type: 'monthly' }, selected: type === 'monthly' },
    {
      label: 'Dias da semana',
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
              label={DAY_NAMES[d].slice(0, 3)}
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

/** Séries, repetições e carga (cards). Salva ao sair de cada campo. */
export function MetaEditor({ task, onSave }: { task: Task; onSave: (meta: Json) => void }) {
  const writable = useCanWrite();
  const meta = (task.meta && typeof task.meta === 'object' ? task.meta : {}) as TaskMeta;
  const [sets, setSets] = useState(meta.sets?.toString() ?? '');
  const [reps, setReps] = useState(meta.reps?.toString() ?? '');
  const [weight, setWeight] = useState(meta.weight ?? '');

  function save() {
    const next: TaskMeta = {};
    const s = parseInt(sets, 10);
    const r = parseInt(reps, 10);
    if (s > 0) next.sets = s;
    if (r > 0) next.reps = r;
    if (weight.trim()) next.weight = weight.trim();
    if (JSON.stringify(next) !== JSON.stringify(meta))
      onSave(Object.keys(next).length ? next : null);
  }

  return (
    <View className="flex-row gap-2">
      {[
        { label: 'Séries', value: sets, set: setSets, numeric: true },
        { label: 'Repetições', value: reps, set: setReps, numeric: true },
        { label: 'Carga', value: weight, set: setWeight, numeric: false },
      ].map((field) => (
        <View key={field.label} className="flex-1 gap-1">
          <Text className="text-xs text-ink-muted">{field.label}</Text>
          <Input
            value={field.value}
            onChangeText={field.set}
            onBlur={save}
            onSubmitEditing={save}
            editable={writable}
            keyboardType={field.numeric ? 'number-pad' : 'default'}
            placeholder={field.numeric ? '0' : '20kg'}
            accessibilityLabel={field.label}
            maxLength={field.numeric ? 4 : 20}
          />
        </View>
      ))}
    </View>
  );
}

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
          value={`🔥 ${streak}`}
          label={
            r?.type === 'weekly'
              ? 'semanas seguidas'
              : r?.type === 'monthly'
                ? 'meses seguidos'
                : 'em sequência'
          }
        />
        <Stat value={String(last30)} label="vezes em 30 dias" />
        <Stat value={recurrenceLabel(r) || 'Todo dia'} label="frequência" />
      </View>
      <View className="gap-1 self-start" accessibilityLabel="Calendário das últimas 5 semanas">
        <View className="flex-row gap-1">
          {WEEK_ORDER.map((d) => (
            <Text key={d} className="w-8 text-center text-xs text-ink-muted">
              {DAYS[d]}
            </Text>
          ))}
        </View>
        {weeks.map((week) => (
          <View key={week[0]} className="flex-row gap-1">
            {week.map((day) => (
              <View
                key={day}
                accessibilityLabel={`${day}: ${done.has(day) ? 'feito' : 'não feito'}`}
                className={cn(
                  'h-8 w-8 items-center justify-center rounded-md',
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
                    'text-xs',
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
      <Text className="text-lg font-bold text-ink">{value}</Text>
      <Text className="text-xs text-ink-muted">{label}</Text>
    </View>
  );
}

const HABIT_KINDS: { value: Task['habit_kind']; label: string; hint: string }[] = [
  { value: 'check', label: '✔️ Marcar', hint: 'Feito ou não feito no período.' },
  {
    value: 'counter',
    label: '🔢 Contador',
    hint: 'Uma meta por período (ex.: 8 copos de água). + soma, − desfaz; bater a meta conclui.',
  },
  {
    value: 'plusminus',
    label: '➕➖ Bom e ruim',
    hint: 'Sem meta: + quando fizer o bom (XP e dano no boss), − quando escorregar (o boss se cura um pouco).',
  },
];

/** Tipo do hábito (D63): marcar, contador com meta ou bom/ruim (+/−). */
export function HabitKindEditor({
  task,
  onSave,
}: {
  task: Task;
  onSave: (patch: Pick<Task, 'habit_kind' | 'habit_target'>) => void;
}) {
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
            label={k.label}
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
      <Text className="text-sm text-ink-muted">{current.hint}</Text>
      {task.habit_kind === 'counter' && (
        <View className="flex-row items-center gap-2">
          <Text className="text-ink">Meta por período:</Text>
          <Input
            value={target}
            onChangeText={(t) => setTarget(t.replace(/\D/g, ''))}
            onBlur={saveTarget}
            onSubmitEditing={saveTarget}
            keyboardType="number-pad"
            editable={writable}
            className="w-20"
            accessibilityLabel="Meta por período"
          />
        </View>
      )}
    </View>
  );
}
