import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { ItemIcon } from '@/components/item-icon';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { HabitRow, useHabitDates } from '@/components/tasks/habit-row';
import { QuickAdd } from '@/components/tasks/quick-add';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { useToday } from '@/lib/queries/profile';
import { useHabits, type HabitTask } from '@/lib/queries/tasks';
import { pageLabel, useTree } from '@/lib/queries/tree';
import { asRecurrence, isHabitDueOn } from '@/lib/recurrence';

type Kind = 'check' | 'counter' | 'plusminus';

const KINDS = [
  {
    value: 'check',
    label: 'habits.kindCheck',
    hint: 'habits.hintCheck',
    example: 'habits.exampleCheck',
  },
  {
    value: 'counter',
    label: 'habits.kindCounter',
    hint: 'habits.hintCounter',
    example: 'habits.exampleCounter',
  },
  {
    value: 'plusminus',
    label: 'habits.kindPlusminus',
    hint: 'habits.hintPlusminus',
    example: 'habits.examplePlusminus',
  },
] as const satisfies readonly { value: Kind; label: string; hint: string; example: string }[];

// Hábitos (D68): todos os hábitos num lugar só, sem precisar de pasta. Os novos vão para a página de
// hábitos de sistema; os de páginas de hábitos em pastas aparecem junto, com o nome da página.
export default function HabitsScreen() {
  const { t } = useTranslation();
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
    { title: t('habits.dueToday'), data: all.filter(dueToday) },
    { title: t('habits.otherDays'), data: all.filter((h) => !dueToday(h)) },
  ].filter((g) => g.data.length > 0);
  const systemId = tree.data?.habits?.id;

  return (
    <Screen size="medium">
      <ScreenHeader title={t('habits.title')} icon={<ItemIcon kind="habits" size={20} />} />
      <View className="gap-3">
        <View className="flex-row flex-wrap items-center gap-2" accessibilityRole="radiogroup">
          {KINDS.map((k) => (
            <Chip
              key={k.value}
              role="radio"
              label={t(k.label)}
              selected={kind === k.value}
              onPress={() => setKind(k.value)}
            />
          ))}
          {kind === 'counter' && (
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-ink-muted">{t('habits.targetLabel')}</Text>
              <Input
                value={target}
                onChangeText={(text) => setTarget(text.replace(/\D/g, '').slice(0, 3))}
                keyboardType="number-pad"
                className="w-16 font-mono"
                accessibilityLabel={t('habits.targetLabel')}
              />
            </View>
          )}
        </View>
        <Text className="text-sm text-ink-muted">{t(current.hint)}</Text>
        <QuickAdd
          pageId={systemId}
          placeholder={t('habits.placeholder', { example: t(current.example) })}
          habit={{
            kind,
            target:
              kind === 'counter' ? Math.min(100, Math.max(1, Number(target) || 1)) : undefined,
          }}
        />
        <Text className="font-mono text-xs text-ink-muted">{t('habits.syntax')}</Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled">
        {groups.map((g) => (
          <View key={g.title}>
            <SectionLabel title={g.title} count={g.data.length} />
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
        {!habits.isPending && all.length === 0 && <EmptyState title={t('habits.empty')} />}
        <View className="h-28" />
      </ScrollView>
    </Screen>
  );
}
