import { Download } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ActionMenu, useDialog } from '@/components/ui/dialog';
import { saveFile } from '@/lib/download';
import { defaultCurrency } from '@/lib/expenses';
import { expensesCsv, expensesXlsx, type ExportLabels } from '@/lib/export-expenses';
import type { Expense } from '@/lib/queries/expenses';
import type { Page } from '@/lib/queries/tree';
import { useToast } from '@/providers/toast';

/** "<página>-2026-10-19": nome de arquivo sem caracteres que os sistemas recusam. */
const fileBase = (name: string) =>
  `${name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'gastos'}-${new Date().toISOString().slice(0, 10)}`;

/** Exportar o que a planilha mostra (o período escolhido) em CSV ou XLSX (ESCOPO_V9 §4). */
export function ExpenseExport({
  page,
  expenses,
  names,
}: {
  page: Page;
  expenses: Expense[];
  names: Map<string, string>;
}) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [open, setOpen, close] = useDialog<true>();
  const methodName = (m: string | null) =>
    m ? (t(`expenses.method.${m}`, { defaultValue: m }) as string) : null;

  const labels: ExportLabels = {
    date: t('expenses.date'),
    description: t('expenses.description'),
    category: t('expenses.category'),
    kind: t('expenses.kind'),
    amount: t('expenses.amount'),
    currency: t('expenses.currency'),
    payer: t('expenses.paidBy'),
    method: t('expenses.methodLabel'),
    note: t('expenses.note'),
    out: t('expenses.out'),
    in: t('expenses.in'),
    settle: t('split.settleKind'),
    entries: t('expenses.entries'),
    summary: t('expenses.summary'),
    spent: t('expenses.spent'),
    received: t('expenses.received'),
    balance: t('expenses.balance'),
    month: t('expenses.month'),
    noCategory: t('expenses.noCategory'),
  };
  // Mais antigo primeiro, como numa planilha
  const rows = [...expenses]
    .sort(
      (a, b) => a.spent_on.localeCompare(b.spent_on) || a.created_at.localeCompare(b.created_at),
    )
    .map((e) => ({
      ...e,
      payer: e.paid_by ? (names.get(e.paid_by) ?? null) : null,
      method: methodName(e.method),
    }));

  const save = (run: () => Promise<void>) =>
    run().catch((err: Error) =>
      toast({ message: t('expenses.exportError', { message: err.message }) }),
    );

  return (
    <>
      <Button
        variant="ghost"
        icon={Download}
        label={t('expenses.export')}
        disabled={expenses.length === 0}
        onPress={() => setOpen(true)}
      />
      {open && (
        <ActionMenu
          title={t('expenses.export')}
          onClose={close}
          actions={[
            {
              label: t('expenses.exportCsv'),
              onPress: () =>
                save(() =>
                  saveFile(
                    `${fileBase(page.name)}.csv`,
                    expensesCsv(rows, labels, !i18n.language.startsWith('en')),
                    'text/csv',
                  ),
                ),
            },
            {
              label: t('expenses.exportXlsx'),
              onPress: () =>
                save(() =>
                  saveFile(
                    `${fileBase(page.name)}.xlsx`,
                    expensesXlsx(rows, labels, defaultCurrency(i18n.language)),
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  ),
                ),
            },
          ]}
        />
      )}
    </>
  );
}
