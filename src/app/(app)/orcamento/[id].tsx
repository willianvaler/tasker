import { useLocalSearchParams } from 'expo-router';
import { Download } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { READABLE, Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { budgetCsv, budgetTotals, spentRatio, type ProjectBudget } from '@/lib/budget';
import { cn } from '@/lib/cn';
import { saveTextFile } from '@/lib/download';
import { formatMoney, parseMoney } from '@/lib/expenses';
import {
  useProjectBudget,
  useProjectRates,
  useSaveRates,
  type ProjectRate,
} from '@/lib/queries/budget';
import { rootFolder, useMembers } from '@/lib/queries/projects';
import { useTree } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

/**
 * Orçamento do projeto (GP4, D316): trabalho (tempo × valor da hora) e gastos, previsto ×
 * realizado, por lista e por pessoa, e o CSV. Quem gerencia define o valor da hora; os outros veem
 * só os totais (o próprio valor, cada um vê).
 */
export default function BudgetScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tree = useTree();
  const root = rootFolder(tree.data, id);
  const budget = useProjectBudget(root?.id);
  const b = budget.data;
  const fmt = (cents: number) => formatMoney(cents, b?.currency ?? 'BRL', i18n.language);

  return (
    <Screen size="medium">
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="pb-clear">
        <ScreenHeader back title={t('budget.title')} eyebrow={root?.name} />
        <View className={cn(READABLE, 'gap-8')}>
          <Text className="text-ink-muted">{t('budget.intro')}</Text>
          {budget.error && <Text className="text-danger">{budget.error.message}</Text>}
          {b && root && (
            <>
              <Totals budget={b} fmt={fmt} />
              {b.pages.length === 0 && b.people.length === 0 ? (
                <Text className="text-ink-muted">{t('budget.empty')}</Text>
              ) : (
                <>
                  <View className="gap-2">
                    <SectionLabel title={t('budget.byList')} />
                    {b.pages.map((p) => (
                      <View key={p.id} className="gap-1 border-b border-line py-2">
                        <Text className="font-semibold text-ink">{p.name}</Text>
                        <Text className="text-sm text-ink-muted">
                          {[
                            p.work_planned || p.work_actual
                              ? `${t('budget.work')}: ${fmt(p.work_actual)} / ${fmt(p.work_planned)}`
                              : null,
                            p.expenses_planned || p.expenses_actual
                              ? `${t('budget.expenses')}: ${fmt(p.expenses_actual)} / ${fmt(p.expenses_planned)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {b.people.length > 0 && (
                    <View className="gap-2">
                      <SectionLabel title={t('budget.byPerson')} />
                      {b.people.map((p) => (
                        <View key={p.user_id} className="flex-row gap-2 border-b border-line py-2">
                          <Text className="flex-1 text-ink">{p.name ?? '?'}</Text>
                          <Text className="text-sm text-ink-muted">
                            {t('budget.minutes', { count: p.minutes })} ·{' '}
                            {p.cents == null ? t('budget.hidden') : fmt(p.cents)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
              <Button
                variant="ghost"
                icon={Download}
                className="self-start"
                label={t('budget.export')}
                onPress={() =>
                  void saveTextFile(
                    `${root.name} - ${t('budget.title')}.csv`,
                    budgetCsv(b),
                    'text/csv',
                  )
                }
              />
              <Rates rootId={root.id} budget={b} fmt={fmt} />
            </>
          )}
        </View>
      </ScreenScroll>
    </Screen>
  );
}

function Totals({ budget: b, fmt }: { budget: ProjectBudget; fmt: (cents: number) => string }) {
  const { t } = useTranslation();
  const totals = budgetTotals(b);
  const rows = [
    { key: 'work', label: t('budget.work'), planned: b.work_planned, actual: b.work_actual },
    {
      key: 'expenses',
      label: t('budget.expenses'),
      planned: b.expenses_planned,
      actual: b.expenses_actual,
    },
    { key: 'total', label: t('budget.total'), planned: totals.planned, actual: totals.actual },
  ];
  return (
    <View className="gap-4">
      {rows.map((r) => {
        const ratio = spentRatio(r.planned, r.actual);
        return (
          <View key={r.key} role="group" aria-label={r.label} className="gap-1">
            <Text className={cn('text-ink', r.key === 'total' && 'font-semibold')}>{r.label}</Text>
            <ProgressBar
              value={Math.min(1, ratio)}
              label={`${r.label}: ${fmt(r.actual)} / ${fmt(r.planned)}`}
              fillClassName={ratio > 1 ? 'bg-danger' : 'bg-accent'}
            />
            <Text className="text-sm text-ink-muted">
              {[
                t('budget.planned', { value: fmt(r.planned) }),
                t('budget.actual', { value: fmt(r.actual) }),
              ].join(' · ')}
            </Text>
            {r.planned > 0 && r.actual > r.planned && (
              <Text className="text-sm text-danger">
                {t('budget.over', { value: fmt(r.actual - r.planned) })}
              </Text>
            )}
          </View>
        );
      })}
      {b.other_currency > 0 && (
        <Text className="text-sm text-ink-muted">
          {t('budget.otherCurrency', { count: b.other_currency })}
        </Text>
      )}
    </View>
  );
}

function Rates({
  rootId,
  budget,
  fmt,
}: {
  rootId: string;
  budget: ProjectBudget;
  fmt: (c: number) => string;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useIsOnline();
  const { session } = useSession();
  const rates = useProjectRates(rootId);
  const members = useMembers(rootId);
  const save = useSaveRates(rootId);
  if (!rates.data) return null;
  if (!budget.manager) {
    const mine = rates.data.find((r) => r.user_id === session?.user.id);
    return mine ? (
      <Text className="text-sm text-ink-muted">
        {t('budget.myRate', { value: fmt(mine.cents_per_hour) })}
      </Text>
    ) : null;
  }
  return (
    <RatesEditor
      key={JSON.stringify(rates.data)}
      rates={rates.data}
      people={(members.data ?? []).map((m) => ({ id: m.userId, name: m.displayName }))}
      online={online}
      saving={save.isPending}
      onSave={(next) =>
        save
          .mutateAsync({ current: rates.data ?? [], next })
          .then(() => toast({ message: t('budget.saved') }))
          .catch((e: Error) => toast({ message: e.message }))
      }
    />
  );
}

function RatesEditor({
  rates,
  people,
  online,
  saving,
  onSave,
}: {
  rates: ProjectRate[];
  people: { id: string; name: string }[];
  online: boolean;
  saving: boolean;
  onSave: (next: { userId: string | null; cents: number | null }[]) => void;
}) {
  const { t } = useTranslation();
  const show = (cents: number | undefined) =>
    cents == null ? '' : (cents / 100).toFixed(2).replace('.', ',');
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries([
      ['default', show(rates.find((r) => r.user_id === null)?.cents_per_hour)],
      ...people.map((p) => [p.id, show(rates.find((r) => r.user_id === p.id)?.cents_per_hour)]),
    ]),
  );
  const parsed = Object.entries(values).map(([key, text]) => ({
    key,
    text,
    cents: text.trim() ? parseMoney(text) : null,
  }));
  const bad = parsed.find((p) => p.text.trim() && p.cents == null);
  const badName = bad
    ? bad.key === 'default'
      ? t('budget.defaultRate')
      : people.find((p) => p.id === bad.key)?.name
    : null;

  return (
    <View className="gap-3">
      <SectionLabel title={t('budget.rates')} />
      <Text className="text-sm text-ink-muted">{t('budget.ratesHint')}</Text>
      {[{ id: 'default', name: t('budget.defaultRate') }, ...people].map((p) => (
        <View key={p.id} className="flex-row items-center gap-3">
          <Text className="flex-1 text-ink">{p.name}</Text>
          <Input
            className="w-32"
            value={values[p.id] ?? ''}
            onChangeText={(v) => setValues((cur) => ({ ...cur, [p.id]: v }))}
            keyboardType="decimal-pad"
            editable={online}
            placeholder={p.id === 'default' ? '0,00' : t('budget.ratePlaceholder')}
            accessibilityLabel={
              p.id === 'default' ? t('budget.defaultRate') : t('budget.rateFor', { name: p.name })
            }
          />
        </View>
      ))}
      {badName && (
        <Text className="text-sm text-danger">{t('budget.invalid', { name: badName })}</Text>
      )}
      <Button
        className="self-start"
        label={t('budget.saveRates')}
        disabled={!online || !!bad}
        loading={saving}
        onPress={() =>
          onSave(
            parsed.map((p) => ({ userId: p.key === 'default' ? null : p.key, cents: p.cents })),
          )
        }
      />
    </View>
  );
}
