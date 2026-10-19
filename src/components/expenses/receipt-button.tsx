import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ActionMenu, DialogFrame, useDialog } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import {
  categorySuggestions,
  dateInput,
  defaultCurrency,
  formatMoney,
  moneyInput,
  parseExpenseDate,
  parseMoney,
} from '@/lib/expenses';
import type { Prepared } from '@/lib/image-prep';
import { formatShortDate } from '@/lib/parser/dates';
import { normalizeReceipt, type ReceiptDraft } from '@/lib/photo-read';
import { newExpenseId, useExpenseMutations, useExpenses } from '@/lib/queries/expenses';
import { PhotoReadError, preparePhoto, readPhoto, uploadReceipt } from '@/lib/queries/photo-read';
import { useToday } from '@/lib/queries/profile';
import { rootFolder, useMembers } from '@/lib/queries/projects';
import { useTree, type Page } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';
import { ExpenseFields, type ExpenseForm } from './expense-fields';
import { useCategoryNames } from './expenses-view';

// Foto da nota (ESCOPO_V9 §2, GA5): câmera ou galeria (várias de uma vez) → a foto é lida no
// servidor (`read-photo`) → a pessoa confere e salva. A foto fica como a nota do lançamento.

type Reviewing = { draft: ReceiptDraft; photo: Prepared };

export function ReceiptButton({ page }: { page: Page }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const online = useIsOnline();
  const [menu, setMenu, closeMenu] = useDialog<true>();
  const [reading, setReading] = useState(0);
  // Fila de notas lidas esperando a conferência (várias fotos de uma vez)
  const [queue, setQueue] = useState<Reviewing[]>([]);
  const today = useToday();

  const failure = (err: unknown) => {
    const code = err instanceof PhotoReadError ? err.code : 'failed';
    toast({
      message: t(`expenses.photo.${code}`, {
        limit: err instanceof PhotoReadError ? err.limit : undefined,
      }),
    });
  };

  async function pick(camera: boolean) {
    if (!online) return toast({ message: t('expenses.photo.offline') });
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return toast({ message: t('attach.noCamera') });
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: !camera,
      selectionLimit: 10,
    };
    const result = camera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    setReading((n) => n + result.assets.length);
    // Uma por vez: o plano gratuito do Gemini aceita poucas por minuto
    for (const asset of result.assets) {
      try {
        const photo = await preparePhoto(asset.uri, asset.width, asset.height);
        const { result: raw } = await readPhoto(photo, 'receipt', i18n.language);
        const draft = normalizeReceipt(raw, today);
        if (!draft.readable) toast({ message: t('expenses.photo.unreadable') });
        setQueue((q) => [...q, { draft, photo }]);
      } catch (err) {
        failure(err);
      } finally {
        setReading((n) => n - 1);
      }
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        icon={Camera}
        label={t('expenses.photo.button')}
        disabled={reading > 0}
        onPress={() => setMenu(true)}
      />
      {reading > 0 && (
        <View className="flex-row items-center gap-2" role="status">
          <ActivityIndicator size="small" />
          <Text className="text-sm text-ink-muted">
            {t('expenses.photo.reading', { count: reading })}
          </Text>
        </View>
      )}
      {menu && (
        <ActionMenu
          title={t('expenses.photo.button')}
          onClose={closeMenu}
          actions={[
            { label: t('expenses.photo.camera'), onPress: () => pick(true) },
            { label: t('expenses.photo.gallery'), onPress: () => pick(false) },
          ]}
        />
      )}
      {queue[0] && (
        <ReceiptReview
          key={queue.length}
          page={page}
          reviewing={queue[0]}
          left={queue.length - 1}
          onDone={() => setQueue((q) => q.slice(1))}
        />
      )}
    </>
  );
}

/** Conferir a nota lida antes de salvar: tudo editável; um lançamento só ou um por item. */
function ReceiptReview({
  page,
  reviewing: { draft, photo },
  left,
  onDone,
}: {
  page: Page;
  reviewing: Reviewing;
  left: number;
  onDone: () => void;
}) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const today = useToday();
  const me = useSession().session?.user.id ?? null;
  const tree = useTree();
  const members = useMembers(rootFolder(tree.data, page.folder_id)?.id);
  const expenses = useExpenses(page.id);
  const m = useExpenseMutations(page.id);
  const categoryNames = useCategoryNames();
  const locale = i18n.language;
  const monthFirst = locale.startsWith('en');
  const currency = defaultCurrency(locale);
  const [form, setForm] = useState<ExpenseForm>(() => ({
    description: draft.description,
    amount: draft.amount_cents ? moneyInput(draft.amount_cents, !monthFirst) : '',
    date: dateInput(draft.spent_on, monthFirst),
    kind: 'out',
    category: draft.category
      ? (t(`expenses.cat.${draft.category}` as 'expenses.cat.other') as string)
      : '',
    method: draft.method,
    paidBy: me,
    note: '',
  }));
  const [perItem, setPerItem] = useState(false);
  const [saving, setSaving] = useState(false);
  // A mesma nota já lançada nesta página (a chave da NFC-e não entra duas vezes)
  const duplicate = draft.nfce_key
    ? expenses.data?.find((e) => e.nfce_key === draft.nfce_key)
    : undefined;

  async function save() {
    const cents = parseMoney(form.amount);
    const date = parseExpenseDate(form.date, today, monthFirst);
    if (!perItem && (!form.description.trim() || !cents))
      return toast({ message: t('expenses.badAmount') });
    if (!date) return toast({ message: t('expenses.badDate') });
    setSaving(true);
    const base = {
      spent_on: date,
      kind: form.kind,
      category: form.category.trim() || null,
      method: form.method,
      paid_by: form.paidBy,
      currency,
      note: form.note.trim() || null,
    };
    const rows = perItem
      ? draft.items.map((it, i) => ({
          ...base,
          id: newExpenseId(),
          description: it.description,
          amount_cents: it.amount_cents,
          // A chave só no primeiro: a mesma nota não entra duas vezes na página
          nfce_key: i === 0 && !duplicate ? draft.nfce_key : null,
        }))
      : [
          {
            ...base,
            id: newExpenseId(),
            description: form.description.trim(),
            amount_cents: cents ?? 0,
            nfce_key: duplicate ? null : draft.nfce_key,
            items: draft.items.length ? draft.items : null,
          },
        ];
    try {
      for (const row of rows) await m.create.mutateAsync(row);
      onDone();
      toast({ message: t('expenses.photo.saved', { count: rows.length }) });
      // A foto sobe depois (o lançamento já está salvo; sem ela, só fica sem a nota anexada)
      const path = await uploadReceipt(page.folder_id, rows[0].id, photo);
      for (const row of rows) await m.update.mutateAsync({ id: row.id, receipt_path: path });
    } catch (err) {
      setSaving(false);
      toast({ message: t('expenses.photo.saveFailed', { message: (err as Error).message }) });
    }
  }

  const people = members.data ?? [];
  return (
    <DialogFrame onClose={onDone} wide>
      <ScrollView contentContainerClassName="gap-4" keyboardShouldPersistTaps="handled">
        <Text className="text-lg font-semibold text-ink">{t('expenses.photo.review')}</Text>
        <Text className="text-sm text-ink-muted">
          {t('expenses.photo.reviewHint')}
          {left > 0 ? ` ${t('expenses.photo.more', { count: left })}` : ''}
        </Text>
        {duplicate && (
          <Text className="text-sm text-warn" role="alert">
            {t('expenses.photo.duplicate', {
              description: duplicate.description,
              date: formatShortDate(duplicate.spent_on),
            })}
          </Text>
        )}
        <ExpenseFields
          value={form}
          onChange={setForm}
          categories={categorySuggestions(expenses.data ?? [], categoryNames)}
          people={people}
          editable={!perItem}
        />
        {draft.items.length > 1 && (
          <View className="gap-2">
            <ToggleRow
              title={t('expenses.photo.perItem')}
              hint={t('expenses.photo.perItemHint', { count: draft.items.length })}
              value={perItem}
              onChange={setPerItem}
            />
            <View className="gap-1">
              {draft.items.slice(0, 8).map((it, i) => (
                <View key={i} className="flex-row justify-between gap-2">
                  <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
                    {it.description}
                  </Text>
                  <Text className="font-mono text-sm text-ink">
                    {formatMoney(it.amount_cents, currency, locale)}
                  </Text>
                </View>
              ))}
              {draft.items.length > 8 && (
                <Text className="text-sm text-ink-muted">
                  {t('expenses.photo.moreItems', { count: draft.items.length - 8 })}
                </Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>
      <View className="flex-row justify-end gap-2">
        <Button variant="ghost" label={t('expenses.photo.discard')} onPress={onDone} />
        <Button label={t('common.save')} onPress={save} disabled={saving} />
      </View>
    </DialogFrame>
  );
}
