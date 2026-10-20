import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/expenses';
import { newExpenseId, useExpenseMutations, type Expense } from '@/lib/queries/expenses';
import { balances, settlements } from '@/lib/split';
import { useToast } from '@/providers/toast';

/**
 * Racha de contas (PB5, D225): saldo de cada pessoa em todos os lançamentos da página (não só no
 * mês: dívida não vence com o mês) e os acertos que fecham a conta. "Registrar acerto" lança um
 * acerto, que fica na lista mas fora dos totais.
 */
export function SplitSection({
  pageId,
  expenses,
  names,
  canWrite,
  today,
}: {
  pageId: string;
  expenses: Expense[];
  names: Map<string, string>;
  canWrite: boolean;
  today: string;
}) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const m = useExpenseMutations(pageId);
  if (!expenses.some((e) => e.split_among && e.split_among.length > 0)) return null;
  const all = balances(expenses);
  const transfers = settlements(all);
  const money = (cents: number, currency: string) => formatMoney(cents, currency, i18n.language);
  const name = (id: string) => names.get(id) ?? t('split.formerMember');

  function settle(from: string, to: string, cents: number, currency: string) {
    m.create.mutate(
      {
        id: newExpenseId(),
        description: t('split.settleDescription', { from: name(from), to: name(to) }),
        amount_cents: cents,
        currency,
        kind: 'settle',
        paid_by: from,
        split_among: [to],
        spent_on: today,
      },
      { onError: (err) => toast({ message: err.message }) },
    );
  }

  const rows = [...all].flatMap(([currency, of]) =>
    [...of].map(([person, cents]) => ({ person, cents, currency })),
  );

  return (
    <View className="gap-2" accessibilityLabel={t('split.title')}>
      <SectionLabel title={t('split.title')} />
      <Text className="text-sm text-ink-muted">{t('split.intro')}</Text>
      {rows
        .sort((a, b) => b.cents - a.cents || name(a.person).localeCompare(name(b.person)))
        .map((r) => (
          <View key={`${r.currency}:${r.person}`} className="flex-row justify-between gap-2">
            <Text className="text-sm text-ink">{name(r.person)}</Text>
            <Text
              className={cn(
                'font-mono text-sm',
                r.cents > 0 ? 'text-ok' : r.cents < 0 ? 'text-danger' : 'text-ink-muted',
              )}
            >
              {r.cents > 0
                ? t('split.toReceive', { value: money(r.cents, r.currency) })
                : r.cents < 0
                  ? t('split.owes', { value: money(-r.cents, r.currency) })
                  : t('split.even')}
            </Text>
          </View>
        ))}
      {transfers.length === 0 ? (
        <Text className="text-sm text-ok" role="status">
          {t('split.allEven')}
        </Text>
      ) : (
        <View className="gap-2 pt-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('split.howToSettle')}
          </Text>
          {transfers.map((tr) => {
            const text = t('split.transfer', {
              from: name(tr.from),
              to: name(tr.to),
              value: money(tr.cents, tr.currency),
            });
            return (
              <View
                key={`${tr.currency}:${tr.from}:${tr.to}`}
                className="flex-row flex-wrap items-center justify-between gap-2 rounded border border-line p-2"
              >
                <Text className="flex-1 text-sm text-ink">{text}</Text>
                {canWrite && (
                  <Button
                    variant="ghost"
                    label={t('split.register')}
                    accessibilityLabel={t('split.registerLabel', { transfer: text })}
                    onPress={() => settle(tr.from, tr.to, tr.cents, tr.currency)}
                  />
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
