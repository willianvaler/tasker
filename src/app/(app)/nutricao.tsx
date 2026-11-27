import * as DocumentPicker from 'expo-document-picker';
import { FileUp, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { READABLE, Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button, IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog, DialogFrame } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { newFood, useFoodMutations, useFoods } from '@/lib/queries/nutrition';
import { readPickedBytes } from '@/lib/read-bytes';
import {
  parseFoodsCsv,
  parseNutrient,
  type Food,
  type FoodBasis,
  type FoodInput,
} from '@/lib/recipes';
import { useToast } from '@/providers/toast';

// Tabela nutricional da própria pessoa (SA5, D391): cada alimento com kcal, proteína, carboidrato e
// gordura por 100 g, por 100 mL ou por unidade, digitados ou importados de um CSV. É de onde as
// receitas tiram os macros por porção; não há base nutricional de fora.
const BASES: FoodBasis[] = ['g', 'ml', 'un'];

export default function NutritionScreen() {
  const { t, i18n } = useTranslation();
  const foods = useFoods();
  const actions = useFoodMutations();
  const toast = useToast();
  const [editing, setEditing] = useState<Food | 'new' | null>(null);
  const [removing, setRemoving] = useState<Food | null>(null);
  const fail = (e: Error) => toast({ message: e.message });
  const n = (v: number) => (Math.round(v * 10) / 10).toLocaleString(i18n.language);

  async function importCsv() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const asset = res.assets[0];
      if ((asset.size ?? 0) > 2 * 1024 * 1024) return toast({ message: t('nutrition.csvTooBig') });
      const text = new TextDecoder().decode(await readPickedBytes(asset));
      const { foods: rows, skipped } = parseFoodsCsv(text);
      if (rows.length === 0) return toast({ message: t('nutrition.csvEmpty') });
      await actions.add.mutateAsync(rows.slice(0, 2000).map(newFood));
      toast({ message: t('nutrition.imported', { count: rows.length, skipped }) });
    } catch (e) {
      fail(e as Error);
    }
  }

  return (
    <Screen size="medium">
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="gap-6 pb-clear">
        <ScreenHeader back help="bem-estar" title={t('nutrition.title')} />
        <Text className={`text-sm text-ink-muted ${READABLE}`}>{t('nutrition.intro')}</Text>
        <View className="flex-row flex-wrap gap-2">
          <Button icon={Plus} label={t('nutrition.add')} onPress={() => setEditing('new')} />
          <Button
            variant="ghost"
            icon={FileUp}
            label={t('nutrition.import')}
            onPress={() => void importCsv()}
          />
        </View>
        <Text className={`font-mono text-xs text-ink-muted ${READABLE}`}>
          {t('nutrition.csvFormat')}
        </Text>

        {foods.data && foods.data.length === 0 ? (
          <Text className={`text-ink-muted ${READABLE}`}>{t('nutrition.empty')}</Text>
        ) : (
          <View>
            {(foods.data ?? []).map((f) => (
              <View
                key={f.id}
                accessibilityLabel={f.name}
                className="min-h-12 flex-row items-center gap-2 border-b border-line py-1"
              >
                <View className="flex-1">
                  <Text className="text-base text-ink">{f.name}</Text>
                  <Text className="text-xs text-ink-muted">
                    {t('nutrition.row', {
                      basis: t(`nutrition.basis.${f.basis}`),
                      kcal: n(f.kcal),
                      protein: n(f.protein),
                      carbs: n(f.carbs),
                      fat: n(f.fat),
                    })}
                  </Text>
                </View>
                <IconButton
                  icon={Pencil}
                  label={t('nutrition.edit', { name: f.name })}
                  onPress={() => setEditing(f)}
                />
                <IconButton
                  icon={Trash2}
                  tone="danger"
                  label={t('nutrition.remove', { name: f.name })}
                  onPress={() => setRemoving(f)}
                />
              </View>
            ))}
          </View>
        )}

        {editing && (
          <FoodForm
            food={editing === 'new' ? null : editing}
            onClose={() => setEditing(null)}
            onSave={(input) => {
              const current = editing;
              setEditing(null);
              if (current === 'new') actions.add.mutate([newFood(input)], { onError: fail });
              else actions.update.mutate({ ...input, id: current.id }, { onError: fail });
            }}
          />
        )}
        {removing && (
          <ConfirmDialog
            title={t('nutrition.removeTitle')}
            message={t('nutrition.removeBody', { name: removing.name })}
            confirmLabel={t('common.delete')}
            destructive
            onClose={() => setRemoving(null)}
            onConfirm={() => {
              const id = removing.id;
              setRemoving(null);
              actions.remove.mutate(id, { onError: fail });
            }}
          />
        )}
      </ScreenScroll>
    </Screen>
  );
}

type Field = 'name' | 'kcal' | 'protein' | 'carbs' | 'fat';

function FoodForm({
  food,
  onSave,
  onClose,
}: {
  food: Food | null;
  onSave: (input: FoodInput) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const num = (v: number | undefined) =>
    v === undefined ? '' : String(v).replace('.', i18n.language === 'en' ? '.' : ',');
  const [basis, setBasis] = useState<FoodBasis>(food?.basis ?? 'g');
  const [values, setValues] = useState<Record<Field, string>>({
    name: food?.name ?? '',
    kcal: num(food?.kcal),
    protein: num(food?.protein),
    carbs: num(food?.carbs),
    fat: num(food?.fat),
  });
  const parsed = {
    kcal: parseNutrient(values.kcal),
    protein: parseNutrient(values.protein),
    carbs: parseNutrient(values.carbs),
    fat: parseNutrient(values.fat),
  };
  const numbersOk = Object.values(parsed).every((v) => v !== null);
  const valid = !!values.name.trim() && numbersOk;

  function save() {
    if (!valid) return;
    onSave({
      name: values.name.trim(),
      basis,
      kcal: parsed.kcal ?? 0,
      protein: parsed.protein ?? 0,
      carbs: parsed.carbs ?? 0,
      fat: parsed.fat ?? 0,
    });
  }

  const field = (k: Field, label: string, extra: object = {}) => (
    <View className="flex-1 gap-1">
      <Text className="text-sm text-ink-muted">{label}</Text>
      <Input
        accessibilityLabel={label}
        value={values[k]}
        maxLength={k === 'name' ? 80 : 10}
        onChangeText={(text) => setValues((v) => ({ ...v, [k]: text }))}
        onSubmitEditing={save}
        {...extra}
      />
    </View>
  );

  return (
    <DialogFrame onClose={onClose}>
      <Text accessibilityRole="header" className="text-lg font-semibold text-ink">
        {food ? t('nutrition.editTitle') : t('nutrition.addTitle')}
      </Text>
      {field('name', t('nutrition.name'), { autoFocus: true })}
      <View className="gap-1">
        <Text className="text-sm text-ink-muted">{t('nutrition.per')}</Text>
        <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
          {BASES.map((b) => (
            <Chip
              key={b}
              label={t(`nutrition.basis.${b}`)}
              selected={basis === b}
              role="radio"
              onPress={() => setBasis(b)}
            />
          ))}
        </View>
      </View>
      <View className="flex-row gap-2">
        {field('kcal', t('nutrition.kcal'), { keyboardType: 'decimal-pad' })}
        {field('protein', t('nutrition.protein'), { keyboardType: 'decimal-pad' })}
      </View>
      <View className="flex-row gap-2">
        {field('carbs', t('nutrition.carbs'), { keyboardType: 'decimal-pad' })}
        {field('fat', t('nutrition.fat'), { keyboardType: 'decimal-pad' })}
      </View>
      {!numbersOk && <Text className="text-sm text-danger">{t('nutrition.badNumber')}</Text>}
      <View className="flex-row justify-end gap-2">
        <Button variant="ghost" label={t('common.cancel')} onPress={onClose} />
        <Button label={t('common.save')} onPress={save} disabled={!valid} />
      </View>
    </DialogFrame>
  );
}
