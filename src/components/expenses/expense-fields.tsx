import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { PAYMENT_METHODS, type ExpenseKind } from '@/lib/expenses';
import type { Member } from '@/lib/queries/projects';

/** O lançamento como a pessoa digita (texto); quem salva converte (parseMoney, parseExpenseDate). */
export type ExpenseForm = {
  description: string;
  amount: string;
  date: string;
  kind: ExpenseKind;
  category: string;
  method: string | null;
  paidBy: string | null;
  note: string;
};

function Label({ children }: { children: string }) {
  return (
    <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{children}</Text>
  );
}

/** Campos do lançamento (revisão da foto e painel). */
export function ExpenseFields({
  value,
  onChange,
  onBlur,
  categories,
  people,
  editable = true,
}: {
  value: ExpenseForm;
  onChange: (next: ExpenseForm) => void;
  onBlur?: () => void;
  /** Sugestões de categoria (usadas na página e as padrão) */
  categories: string[];
  /** Membros do projeto (com mais de um, aparece "Quem pagou") */
  people: Member[];
  editable?: boolean;
}) {
  const { t } = useTranslation();
  const set = <K extends keyof ExpenseForm>(key: K, v: ExpenseForm[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Label>{t('expenses.description')}</Label>
        <Input
          value={value.description}
          onChangeText={(v) => set('description', v)}
          onBlur={onBlur}
          editable={editable}
          maxLength={200}
          placeholder={t('expenses.descriptionPlaceholder')}
          accessibilityLabel={t('expenses.description')}
        />
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1 gap-1">
          <Label>{t('expenses.amount')}</Label>
          <Input
            value={value.amount}
            onChangeText={(v) => set('amount', v)}
            onBlur={onBlur}
            editable={editable}
            keyboardType="decimal-pad"
            maxLength={20}
            className="font-mono"
            accessibilityLabel={t('expenses.amount')}
          />
        </View>
        <View className="flex-1 gap-1">
          <Label>{t('expenses.date')}</Label>
          <Input
            value={value.date}
            onChangeText={(v) => set('date', v)}
            onBlur={onBlur}
            editable={editable}
            maxLength={10}
            placeholder={t('expenses.datePlaceholder')}
            className="font-mono"
            accessibilityLabel={t('expenses.date')}
          />
        </View>
      </View>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {(['out', 'in'] as const).map((k) => (
          <Chip
            key={k}
            role="radio"
            label={t(`expenses.${k}`)}
            selected={value.kind === k}
            disabled={!editable}
            onPress={() => set('kind', k)}
          />
        ))}
      </View>
      <View className="gap-2">
        <Label>{t('expenses.category')}</Label>
        <Input
          value={value.category}
          onChangeText={(v) => set('category', v)}
          onBlur={onBlur}
          editable={editable}
          maxLength={60}
          placeholder={t('expenses.categoryPlaceholder')}
          accessibilityLabel={t('expenses.category')}
        />
        <View className="flex-row flex-wrap gap-2">
          {categories.slice(0, 10).map((c) => (
            <Chip
              key={c}
              role="radio"
              label={c}
              selected={value.category === c}
              disabled={!editable}
              onPress={() => set('category', value.category === c ? '' : c)}
            />
          ))}
        </View>
      </View>
      <View className="gap-2">
        <Label>{t('expenses.methodLabel')}</Label>
        <View className="flex-row flex-wrap gap-2">
          {PAYMENT_METHODS.map((m) => (
            <Chip
              key={m}
              role="radio"
              label={t(`expenses.method.${m}`)}
              selected={value.method === m}
              disabled={!editable}
              onPress={() => set('method', value.method === m ? null : m)}
            />
          ))}
        </View>
      </View>
      {people.length > 1 && (
        <View className="gap-2">
          <Label>{value.kind === 'in' ? t('expenses.receivedBy') : t('expenses.paidBy')}</Label>
          <View className="flex-row flex-wrap gap-2">
            {people.map((p) => (
              <Chip
                key={p.userId}
                role="radio"
                label={p.displayName}
                selected={value.paidBy === p.userId}
                disabled={!editable}
                onPress={() => set('paidBy', value.paidBy === p.userId ? null : p.userId)}
              />
            ))}
          </View>
        </View>
      )}
      <View className="gap-1">
        <Label>{t('expenses.note')}</Label>
        <Input
          value={value.note}
          onChangeText={(v) => set('note', v)}
          onBlur={onBlur}
          editable={editable}
          multiline
          maxLength={2000}
          className="min-h-16"
          accessibilityLabel={t('expenses.note')}
        />
      </View>
    </View>
  );
}
