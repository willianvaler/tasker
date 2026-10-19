import { router, useLocalSearchParams } from 'expo-router';
import { Trash2, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { useCategoryNames } from '@/components/expenses/expenses-view';
import { ExpenseFields, type ExpenseForm } from '@/components/expenses/expense-fields';
import { Button, IconButton } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import {
  categorySuggestions,
  dateInput,
  formatMoney,
  moneyInput,
  parseExpenseDate,
  parseMoney,
} from '@/lib/expenses';
import { openUrl } from '@/lib/open-url';
import { can } from '@/lib/permissions';
import { useExpense, useExpenseMutations, useExpenses, type Expense } from '@/lib/queries/expenses';
import { receiptUrl } from '@/lib/queries/photo-read';
import { useToday } from '@/lib/queries/profile';
import { rootFolder, useFolderActor, useMembers } from '@/lib/queries/projects';
import { useTree } from '@/lib/queries/tree';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';
import { useCanWrite } from '@/providers/write';

// Painel de um lançamento de gasto (ESCOPO_V9 §1): todos os campos, a foto da nota e os itens
// lidos dela. Salva ao fechar (como o painel da tarefa); apagar vai para a lixeira.

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function ExpenseScreen() {
  const { id, page: pageId } = useLocalSearchParams<{ id: string; page: string }>();
  const expense = useExpense(pageId, id);
  const { t } = useTranslation();
  if (!expense.data)
    return (
      <Sheet onClose={close} header={<Header title={t('expenses.entry')} onClose={close} />}>
        {expense.isPending ? null : <Text className="text-ink-muted">{t('expenses.missing')}</Text>}
      </Sheet>
    );
  return <Editor expense={expense.data} />;
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="min-h-12 flex-row items-center gap-2 border-b border-line pl-4 pr-2">
      <Text className="flex-1 font-mono text-xs uppercase text-ink-muted">{title}</Text>
      <IconButton icon={X} label={t('common.close')} onPress={onClose} />
    </View>
  );
}

function Editor({ expense: e }: { expense: Expense }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const today = useToday();
  const me = useSession().session?.user.id;
  const locale = i18n.language;
  const monthFirst = locale.startsWith('en');
  const m = useExpenseMutations(e.page_id);
  const all = useExpenses(e.page_id);
  const tree = useTree();
  const page = tree.data?.pages.find((p) => p.id === e.page_id);
  const members = useMembers(rootFolder(tree.data, page?.folder_id)?.id);
  const actor = useFolderActor(page?.folder_id);
  const writable = useCanWrite(page?.folder_id, { offline: true });
  // Colaborador só mexe no que lançou (o banco confere de novo)
  const editable =
    writable &&
    (!actor || can(actor, 'expense.write', { createdBy: e.created_by, assigneeIds: [] }));
  const categoryNames = useCategoryNames();

  const initial: ExpenseForm = {
    description: e.description,
    amount: moneyInput(e.amount_cents, !monthFirst),
    date: dateInput(e.spent_on, monthFirst),
    kind: e.kind === 'in' ? 'in' : 'out',
    category: e.category ?? '',
    method: e.method,
    paidBy: e.paid_by,
    note: e.note ?? '',
  };
  const [form, setForm] = useState(initial);

  /** O que mudou, já convertido; null se algo não vale (valor ou data). */
  function patch() {
    const cents = parseMoney(form.amount);
    const date = parseExpenseDate(form.date, today, monthFirst);
    if (!form.description.trim() || !cents || !date) return null;
    const next = {
      description: form.description.trim(),
      amount_cents: cents,
      spent_on: date,
      kind: form.kind,
      category: form.category.trim() || null,
      method: form.method,
      paid_by: form.paidBy,
      note: form.note.trim() || null,
    };
    const changed = Object.fromEntries(
      Object.entries(next).filter(([k, v]) => e[k as keyof Expense] !== v),
    );
    return changed;
  }

  function save() {
    if (!editable) return true;
    const changed = patch();
    if (!changed) {
      toast({ message: t('expenses.invalid') });
      return false;
    }
    if (Object.keys(changed).length)
      m.update.mutate(
        { id: e.id, ...changed },
        { onError: (err) => toast({ message: err.message }) },
      );
    return true;
  }
  const saveAndClose = () => save() && close();

  function remove() {
    m.remove.mutate(e.id, { onError: (err) => toast({ message: err.message }) });
    toast({ message: t('expenses.removed', { description: e.description }) });
    close();
  }

  // Foto da nota: link assinado (1 h)
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    if (!e.receipt_path) return;
    let gone = false;
    receiptUrl(e.receipt_path)
      .then((url) => !gone && setPhoto(url))
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, [e.receipt_path]);

  const people = members.data ?? [];
  const createdBy = people.find((p) => p.userId === e.created_by)?.displayName;
  return (
    <Sheet
      onClose={saveAndClose}
      header={<Header title={t('expenses.entry')} onClose={saveAndClose} />}
    >
      <ExpenseFields
        value={form}
        onChange={setForm}
        categories={categorySuggestions(all.data ?? [], categoryNames)}
        people={people}
        editable={editable}
      />
      {photo && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('expenses.openReceipt')}
          onPress={() => openUrl(photo)}
          className="gap-2"
        >
          <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('expenses.receipt')}
          </Text>
          <Image
            source={{ uri: photo }}
            accessibilityIgnoresInvertColors
            style={{ width: '100%', height: 320, borderRadius: 8 }}
            contentFit="contain"
          />
        </Pressable>
      )}
      {e.items && e.items.length > 0 && (
        <View className="gap-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('expenses.items')}
          </Text>
          {e.items.map((it, i) => (
            <View key={i} className="flex-row justify-between gap-2">
              <Text className="flex-1 text-sm text-ink" numberOfLines={2}>
                {it.description}
              </Text>
              <Text className="font-mono text-sm text-ink">
                {formatMoney(it.amount_cents, e.currency, locale)}
              </Text>
            </View>
          ))}
        </View>
      )}
      {e.nfce_key && (
        <Text className="font-mono text-xs text-ink-muted" selectable>
          {t('expenses.nfceKey', { key: e.nfce_key.replace(/(\d{4})(?=\d)/g, '$1 ') })}
        </Text>
      )}
      {createdBy && e.created_by !== me && (
        <Text className="text-sm text-ink-muted">
          {t('expenses.createdBy', { name: createdBy })}
        </Text>
      )}
      {editable && (
        <Button
          variant="ghost"
          icon={Trash2}
          label={t('expenses.remove')}
          className="self-start"
          onPress={remove}
        />
      )}
    </Sheet>
  );
}
