import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { HabitRow, useHabitDates } from '@/components/tasks/habit-row';
import { QuickAdd } from '@/components/tasks/quick-add';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useToday } from '@/lib/queries/profile';
import { useHabits, type HabitTask } from '@/lib/queries/tasks';
import { pageLabel, useTree } from '@/lib/queries/tree';
import { asRecurrence, isHabitDueOn } from '@/lib/recurrence';

type Kind = 'check' | 'counter' | 'plusminus';

const KINDS: { value: Kind; label: string; hint: string; example: string }[] = [
  {
    value: 'check',
    label: '✔️ Marcar',
    hint: 'Feito ou não feito no dia (ou na semana, no mês).',
    example: 'Meditar 5 minutos',
  },
  {
    value: 'counter',
    label: '🔢 Contador',
    hint: 'Uma meta por dia: + soma, − desfaz. Bater a meta conta como feito.',
    example: 'Beber um copo de água',
  },
  {
    value: 'plusminus',
    label: '➕➖ Bom e ruim',
    hint: 'Sem meta: + quando fizer o bom (XP e dano no boss), − quando escorregar (o boss se cura um pouco).',
    example: 'Comer bem',
  },
];

// Hábitos (D68): todos os hábitos num lugar só, sem precisar de pasta. Os novos vão para a página de
// hábitos de sistema; os de páginas de hábitos em pastas aparecem junto, com o nome da página.
export default function HabitsScreen() {
  const today = useToday();
  const tree = useTree();
  const habits = useHabits(today);
  const [kind, setKind] = useState<Kind>('check');
  const [target, setTarget] = useState('8');
  const current = KINDS.find((k) => k.value === kind) ?? KINDS[0];

  const all = habits.data ?? [];
  const dates = useHabitDates(all);
  const dueToday = (h: HabitTask) =>
    h.habit_kind === 'plusminus' || isHabitDueOn(asRecurrence(h.recurrence), today);
  const groups = [
    { title: 'Para hoje', data: all.filter(dueToday) },
    { title: 'Em outros dias', data: all.filter((h) => !dueToday(h)) },
  ].filter((g) => g.data.length > 0);
  const systemId = tree.data?.habits?.id;

  return (
    <Screen size="medium">
      <ScreenHeader title="🔥 Hábitos" />
      <View className="gap-2">
        <View className="flex-row flex-wrap items-center gap-2" accessibilityRole="radiogroup">
          {KINDS.map((k) => (
            <Chip
              key={k.value}
              role="radio"
              label={k.label}
              selected={kind === k.value}
              onPress={() => setKind(k.value)}
            />
          ))}
          {kind === 'counter' && (
            <View className="flex-row items-center gap-2">
              <Text className="text-ink">Meta por dia:</Text>
              <Input
                value={target}
                onChangeText={(t) => setTarget(t.replace(/\D/g, '').slice(0, 3))}
                keyboardType="number-pad"
                className="w-16"
                accessibilityLabel="Meta por dia"
              />
            </View>
          )}
        </View>
        <Text className="text-sm text-ink-muted">{current.hint}</Text>
        <QuickAdd
          pageId={systemId}
          placeholder={`Novo hábito… (ex.: ${current.example})`}
          habit={{
            kind,
            target:
              kind === 'counter' ? Math.min(100, Math.max(1, Number(target) || 1)) : undefined,
          }}
        />
        <Text className="text-xs text-ink-muted">
          Repetição no texto: /seg,qua,sex, /semanal, /mensal (sem nada, é todo dia). Para mudar o
          tipo de um hábito depois, toque nele.
        </Text>
      </View>

      <ScrollView className="mt-2" keyboardShouldPersistTaps="handled">
        {groups.map((g) => (
          <View key={g.title}>
            <Text className="mt-4 text-sm font-semibold text-ink-muted">
              {g.title} ({g.data.length})
            </Text>
            {g.data.map((task) => (
              <HabitRow
                key={task.id}
                task={task}
                dates={dates.datesOf(task)}
                today={today}
                // Só mostra a página quando o hábito está numa pasta
                pageLabel={task.page_id === systemId ? undefined : pageLabel(task.page)}
              />
            ))}
          </View>
        ))}
        {!habits.isPending && all.length === 0 && (
          <View className="mt-12 items-center gap-1">
            <Text className="text-xl">🔥</Text>
            <Text className="text-center text-ink-muted">
              Nenhum hábito ainda. Escolha o tipo acima e escreva o primeiro.
            </Text>
          </View>
        )}
        <View className="h-28" />
      </ScrollView>
    </Screen>
  );
}
