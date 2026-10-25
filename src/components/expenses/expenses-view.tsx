import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, type TextInput, useWindowDimensions, View } from 'react-native';

import { ScreenScroll } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { PromptDialog, useDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Grid } from '@/components/ui/grid';
import { Input } from '@/components/ui/input';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SectionLabel } from '@/components/ui/section-label';
import { Tabs } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import {
  budgetUsed,
  byDateDesc,
  categorySuggestions,
  DEFAULT_CATEGORIES,
  defaultCurrency,
  formatMoney,
  inPeriod,
  inTab,
  moneyInput,
  parseMoney,
  summarize,
  type ExpenseKind,
  type ExpensePeriod,
  type ExpenseTab,
} from '@/lib/expenses';
import { formatShortDate } from '@/lib/parser/dates';
import { actorCan } from '@/lib/permissions';
import { getExpenseTab, setExpenseTab } from '@/lib/prefs';
import {
  newExpenseId,
  useExpenseMutations,
  useExpenses,
  type Expense,
} from '@/lib/queries/expenses';
import { useToday } from '@/lib/queries/profile';
import { rootFolder, useFolderActor, useMembers } from '@/lib/queries/projects';
import { useTree, type Page } from '@/lib/queries/tree';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';
import { useCanWrite } from '@/providers/write';
import { ExpenseExport } from './expense-export';
import { ReceiptButton } from './receipt-button';
import { SplitSection } from './split-section';

// Página de gastos (ESCOPO_V9 §1): totais no topo, lançamento rápido e a planilha. Tocar numa
// linha abre o lançamento inteiro (/gasto/<id>). As abas Gastos e Entradas (D255) são a mesma
// página só com as saídas ou só com as entradas: totais, lançamento, lista e exportação da aba.

/** Nome da categoria padrão no idioma; categoria própria aparece como foi escrita. */
export function useCategoryNames() {
  const { t } = useTranslation();
  return DEFAULT_CATEGORIES.map((c) => t(`expenses.cat.${c}`) as string);
}

export function ExpensesView({ page }: { page: Page }) {
  const { t, i18n } = useTranslation();
  const today = useToday();
  const toast = useToast();
  const me = useSession().session?.user.id ?? null;
  const expenses = useExpenses(page.id);
  const m = useExpenseMutations(page.id);
  const tree = useTree();
  const root = rootFolder(tree.data, page.folder_id);
  const members = useMembers(root?.id);
  const actor = useFolderActor(page.folder_id);
  const writable = useCanWrite(page.folder_id, { offline: true });
  // Colaborador lança (e mexe só nos seus: o painel confere de novo)
  const canWrite = writable && (actorCan(actor, 'expense.write') || !actor);
  const { width } = useWindowDimensions();
  const wide = width >= 768;
  const locale = i18n.language;
  const currency = defaultCurrency(locale);
  const money = (cents: number, cur = currency) => formatMoney(cents, cur, locale);

  // Aba lembrada por página no aparelho, como a Lista · Matriz (D221)
  const [tabOf, setTabOf] = useState<{ id: string; tab: ExpenseTab } | null>(null);
  const tab: ExpenseTab = tabOf?.id === page.id ? tabOf.tab : getExpenseTab(page.id);
  function changeTab(next: ExpenseTab) {
    setExpenseTab(page.id, next);
    setTabOf({ id: page.id, tab: next });
  }

  const [period, setPeriod] = useState<ExpensePeriod>('month');
  // O racha e o orçamento olham a página inteira; o resto, só a aba
  const everything = [...(expenses.data ?? [])].sort(byDateDesc);
  const all = inTab(everything, tab);
  const shown = inPeriod(all, period, today);
  const summary = summarize(shown);
  const used = budgetUsed(summarize(everything).spent, page.budget_cents);
  const categoryNames = useCategoryNames();
  const suggestions = categorySuggestions(all, tab === 'in' ? [] : categoryNames);
  const names = new Map((members.data ?? []).map((p) => [p.userId, p.displayName]));
  const people = (members.data ?? []).length > 1;

  // Lançamento rápido: descrição, valor, categoria e saída/entrada; Enter lança
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [chosenKind, setKind] = useState<ExpenseKind>('out');
  const kind: ExpenseKind = tab === 'all' ? chosenKind : tab;
  const descriptionRef = useRef<TextInput>(null);
  const amountRef = useRef<TextInput>(null);

  function add() {
    const cents = parseMoney(amount);
    if (!description.trim()) return descriptionRef.current?.focus();
    if (!cents) {
      toast({ message: t('expenses.badAmount') });
      return amountRef.current?.focus();
    }
    m.create.mutate(
      {
        id: newExpenseId(),
        description: description.trim(),
        amount_cents: cents,
        category,
        kind,
        currency,
        spent_on: today,
        paid_by: kind === 'out' ? me : null,
      },
      { onError: (err) => toast({ message: err.message }) },
    );
    setDescription('');
    setAmount('');
    descriptionRef.current?.focus();
  }

  const [dialog, setDialog, closeDialog] = useDialog<'budget'>();

  const emptyKey =
    tab === 'out'
      ? period === 'month'
        ? 'expenses.emptyOutMonth'
        : 'expenses.emptyOut'
      : tab === 'in'
        ? period === 'month'
          ? 'expenses.emptyInMonth'
          : 'expenses.emptyIn'
        : period === 'month'
          ? 'expenses.emptyMonth'
          : 'expenses.empty';

  return (
    // A tela de gastos não é lista: a rolagem é a da tela (D189), senão o fim fica cortado
    <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="gap-6 pb-clear">
      <Tabs
        label={t('expenses.tabs')}
        value={tab}
        onChange={changeTab}
        tabs={[
          { value: 'all', label: t('expenses.tabAll') },
          { value: 'out', label: t('expenses.tabOut') },
          { value: 'in', label: t('expenses.tabIn') },
        ]}
      />
      <Grid breakpoints={[520, 1000]}>
        {tab !== 'in' && <Stat label={t('expenses.spent')} value={money(summary.spent)} />}
        {tab !== 'out' && <Stat label={t('expenses.received')} value={money(summary.received)} />}
        {tab === 'all' && (
          <Stat
            label={t('expenses.balance')}
            value={money(summary.balance)}
            tone={summary.balance < 0 ? 'danger' : 'ok'}
          />
        )}
        {tab !== 'in' && (
          <View className="gap-2 rounded-lg border border-line p-3">
            <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t('expenses.budget')}
            </Text>
            {page.budget_cents ? (
              <>
                <Text className="font-mono text-base text-ink">
                  {t('expenses.budgetOf', {
                    spent: money(summarize(everything).spent),
                    budget: money(page.budget_cents),
                  })}
                </Text>
                <ProgressBar
                  value={used ?? 0}
                  fillClassName={(used ?? 0) > 1 ? 'bg-danger' : 'bg-accent'}
                  label={t('expenses.budgetUsed', { pct: Math.round((used ?? 0) * 100) })}
                />
              </>
            ) : null}
            {canWrite && (
              <Button
                variant="ghost"
                className="self-start"
                label={t(page.budget_cents ? 'expenses.changeBudget' : 'expenses.setBudget')}
                onPress={() => setDialog('budget')}
              />
            )}
          </View>
        )}
      </Grid>

      <View className="flex-row flex-wrap items-center gap-2">
        <Chip
          role="radio"
          label={t('expenses.thisMonth')}
          selected={period === 'month'}
          onPress={() => setPeriod('month')}
        />
        <Chip
          role="radio"
          label={t('expenses.allTime')}
          selected={period === 'all'}
          onPress={() => setPeriod('all')}
        />
        <View className="flex-1" />
        {canWrite && tab !== 'in' && (
          <ReceiptButton
            page={page}
            onSaved={(date) => {
              if (date.slice(0, 7) !== today.slice(0, 7)) setPeriod('all');
            }}
          />
        )}
        <ExpenseExport page={page} expenses={shown} names={names} />
      </View>

      {canWrite && (
        <View className="gap-2 rounded-lg border border-line p-3">
          <View className={cn('gap-2', wide && 'flex-row')}>
            <Input
              ref={descriptionRef}
              className={wide ? 'flex-[3]' : undefined}
              value={description}
              onChangeText={setDescription}
              placeholder={t('expenses.descriptionPlaceholder')}
              accessibilityLabel={t('expenses.description')}
              maxLength={200}
              submitBehavior="submit"
              onSubmitEditing={() => amountRef.current?.focus()}
            />
            <View className={cn('flex-row gap-2', wide && 'flex-[2]')}>
              <Input
                ref={amountRef}
                className="flex-1 font-mono"
                value={amount}
                onChangeText={setAmount}
                placeholder={moneyInput(0, !locale.startsWith('en'))}
                accessibilityLabel={t('expenses.amount')}
                keyboardType="decimal-pad"
                maxLength={20}
                submitBehavior="submit"
                onSubmitEditing={add}
              />
              <Button label={t('expenses.add')} onPress={add} />
            </View>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {tab === 'all' && (
              <>
                <Chip
                  role="radio"
                  label={t('expenses.out')}
                  selected={kind === 'out'}
                  onPress={() => setKind('out')}
                />
                <Chip
                  role="radio"
                  label={t('expenses.in')}
                  selected={kind === 'in'}
                  onPress={() => setKind('in')}
                />
                <View className="mx-1 w-px self-stretch bg-line" />
              </>
            )}
            {suggestions.slice(0, 8).map((c) => (
              <Chip
                key={c}
                role="radio"
                label={c}
                selected={category === c}
                onPress={() => setCategory(category === c ? null : c)}
              />
            ))}
          </View>
        </View>
      )}

      {summary.byCategory.length > 0 && (
        <View className="gap-2">
          <SectionLabel title={t('expenses.byCategory')} />
          {summary.byCategory.map((c) => (
            <View key={c.category} className="gap-1">
              <View className="flex-row justify-between gap-2">
                <Text className="text-sm text-ink">{c.category || t('expenses.noCategory')}</Text>
                <Text className="font-mono text-sm text-ink">{money(c.cents)}</Text>
              </View>
              <ProgressBar
                value={summary.spent ? c.cents / summary.spent : 0}
                label={t('expenses.categoryShare', {
                  category: c.category || t('expenses.noCategory'),
                  pct: Math.round((c.cents / summary.spent) * 100),
                })}
              />
            </View>
          ))}
        </View>
      )}

      {people && tab !== 'in' && (
        <SplitSection
          pageId={page.id}
          expenses={everything}
          names={names}
          canWrite={canWrite}
          today={today}
        />
      )}

      <View className="gap-1">
        <SectionLabel title={t('expenses.entries')} count={shown.length} />
        {expenses.isPending ? null : shown.length === 0 ? (
          <EmptyState title={t(emptyKey)} hint={canWrite ? t('expenses.emptyHint') : undefined} />
        ) : (
          <>
            {wide && (
              <View className="flex-row gap-3 border-b border-line px-2 pb-2">
                <Head className="w-20">{t('expenses.date')}</Head>
                <Head className="flex-[3]">{t('expenses.description')}</Head>
                <Head className="flex-[2]">{t('expenses.category')}</Head>
                {people && <Head className="flex-[2]">{t('expenses.paidBy')}</Head>}
                <Head className="w-36 text-right">{t('expenses.amount')}</Head>
              </View>
            )}
            {shown.map((e) => (
              <ExpenseRow
                key={e.id}
                expense={e}
                wide={wide}
                people={people}
                payer={e.paid_by ? names.get(e.paid_by) : undefined}
                money={money}
                today={today}
              />
            ))}
          </>
        )}
      </View>

      {dialog === 'budget' && (
        <PromptDialog
          title={t('expenses.budget')}
          message={t('expenses.budgetHint')}
          fields={[
            {
              key: 'budget',
              placeholder: moneyInput(500000, !locale.startsWith('en')),
              initial: page.budget_cents
                ? moneyInput(page.budget_cents, !locale.startsWith('en'))
                : '',
            },
          ]}
          validate={({ budget }) => !budget.trim() || parseMoney(budget) != null}
          onConfirm={({ budget }) => {
            closeDialog();
            m.setBudget.mutate(budget.trim() ? parseMoney(budget) : null, {
              onError: (err) => toast({ message: err.message }),
            });
          }}
          onClose={closeDialog}
        />
      )}
    </ScreenScroll>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'danger' }) {
  return (
    <View
      className="gap-1 rounded-lg border border-line p-3"
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</Text>
      <Text
        className={cn(
          'font-mono text-xl',
          tone === 'danger' ? 'text-danger' : tone === 'ok' ? 'text-ok' : 'text-ink',
        )}
      >
        {value}
      </Text>
    </View>
  );
}

function Head({ className, children }: { className?: string; children: string }) {
  return (
    <Text className={cn('text-xs font-semibold uppercase tracking-wide text-ink-muted', className)}>
      {children}
    </Text>
  );
}

function ExpenseRow({
  expense: e,
  wide,
  people,
  payer,
  money,
  today,
}: {
  expense: Expense;
  wide: boolean;
  people: boolean;
  payer: string | undefined;
  money: (cents: number, currency?: string) => string;
  today: string;
}) {
  const { t } = useTranslation();
  // Acerto do racha (PB5): dinheiro entre as pessoas, nem saída nem entrada
  const sign = e.kind === 'in' ? '+' : e.kind === 'settle' ? '⇄ ' : '−';
  const value = `${sign}${money(e.amount_cents, e.currency)}`;
  const date = e.spent_on === today ? t('expenses.today') : formatShortDate(e.spent_on);
  const open = () =>
    router.push({ pathname: '/gasto/[id]', params: { id: e.id, page: e.page_id } });
  const valueClass = cn(
    'font-mono text-sm',
    e.kind === 'in' ? 'text-ok' : e.kind === 'settle' ? 'text-ink-muted' : 'text-ink',
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('expenses.rowLabel', { description: e.description, value, date })}
      onPress={open}
      className="rounded px-2 py-2 hover:bg-wash active:bg-wash"
    >
      {wide ? (
        <View className="flex-row items-center gap-3">
          <Text className="w-20 font-mono text-sm text-ink-muted">{date}</Text>
          <Text className="flex-[3] text-sm text-ink" numberOfLines={1}>
            {e.description}
            {e.receipt_path ? ' 🧾' : ''}
          </Text>
          <Text className="flex-[2] text-sm text-ink-muted" numberOfLines={1}>
            {e.category ?? ''}
          </Text>
          {people && (
            <Text className="flex-[2] text-sm text-ink-muted" numberOfLines={1}>
              {payer ?? ''}
            </Text>
          )}
          <Text className={cn('w-36 text-right', valueClass)}>{value}</Text>
        </View>
      ) : (
        <View className="gap-1">
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
              {e.description}
              {e.receipt_path ? ' 🧾' : ''}
            </Text>
            <Text className={valueClass}>{value}</Text>
          </View>
          <Text className="text-xs text-ink-muted" numberOfLines={1}>
            {[date, e.category, people ? payer : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
