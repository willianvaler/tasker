import { router } from 'expo-router';
import { Minus, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { READABLE, ScreenScroll } from '@/components/screen';
import { Button, IconButton } from '@/components/ui/button';
import { ActionMenu, ConfirmDialog, DialogFrame } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  formatQty,
  PANTRY_MAX,
  pantryNeeds,
  parseQty,
  sortPantry,
  type PantryItem,
} from '@/lib/pantry';
import { actorCan } from '@/lib/permissions';
import { pantryShopping, usePantry, usePantryMutations } from '@/lib/queries/pantry';
import { useFolderActor } from '@/lib/queries/projects';
import { useTree, useTreeMutations, type Page } from '@/lib/queries/tree';
import { uuidv7 } from '@/lib/uuid';
import { useToast } from '@/providers/toast';
import { useCanWrite } from '@/providers/write';

/**
 * Despensa (CS4, D390): uma lista do tipo 'pantry'. Cada item tem quantidade, mínimo e quanto
 * comprar de cada vez; **Acabou** zera. O que acabou ou ficou abaixo do mínimo vai, pelo servidor,
 * para a lista de compras escolhida (uma lista comum da mesma pasta), uma vez só; marcar a compra
 * como feita soma ao estoque. Num projeto, vale para todo mundo da casa.
 */
export function PantryView({ page }: { page: Page }) {
  const { t } = useTranslation();
  const items = usePantry(page.id);
  const actions = usePantryMutations(page.id);
  const tree = useTree();
  const { createPage, updatePage } = useTreeMutations();
  const actor = useFolderActor(page.folder_id);
  const writable = useCanWrite(page.folder_id, { offline: true }) && actorCan(actor, 'task.create');
  const manage = useCanWrite(page.folder_id) && actorCan(actor, 'page.manage');
  const toast = useToast();
  const [editing, setEditing] = useState<PantryItem | 'new' | null>(null);
  const [removing, setRemoving] = useState<PantryItem | null>(null);
  const [choosing, setChoosing] = useState(false);
  const fail = (e: Error) => toast({ message: e.message });

  const lists = (tree.data?.pages ?? []).filter(
    (p) =>
      p.folder_id === page.folder_id &&
      p.id !== page.id &&
      (p.view_type === 'list' || p.view_type === 'cards' || p.view_type === 'kanban'),
  );
  const shoppingId = pantryShopping(page.config);
  const shopping = lists.find((p) => p.id === shoppingId);
  const sorted = sortPantry(items.data ?? []);
  const toBuy = sorted.filter((i) => pantryNeeds(i.qty, i.min_qty)).length;

  const setShopping = (id: string) =>
    updatePage.mutateAsync({
      id: page.id,
      name: page.name,
      icon: page.icon,
      config: { ...((page.config as object | null) ?? {}), pantry: { shopping: id } },
    });

  async function createShopping() {
    setChoosing(false);
    try {
      const id = await createPage.mutateAsync({
        folderId: page.folder_id,
        name: t('pantry.shoppingDefault'),
        view_type: 'list',
      });
      await setShopping(id);
    } catch (e) {
      fail(e as Error);
    }
  }

  const step = (item: PantryItem, delta: number) =>
    actions.update.mutate(
      { id: item.id, qty: Math.max(0, Math.min(PANTRY_MAX, item.qty + delta)) },
      { onError: fail },
    );

  return (
    <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="gap-6 pb-clear">
      <View className={`gap-2 ${READABLE}`}>
        {shopping ? (
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-sm text-ink-muted">
              {t('pantry.shoppingIs', { name: shopping.name })}
            </Text>
            <Button
              variant="ghost"
              label={t('pantry.openShopping')}
              onPress={() => router.push({ pathname: '/page/[id]', params: { id: shopping.id } })}
            />
            {manage && (
              <Button
                variant="ghost"
                label={t('pantry.change')}
                onPress={() => setChoosing(true)}
              />
            )}
          </View>
        ) : (
          <View className="gap-2 rounded border border-line p-3">
            <Text className="text-sm text-ink">{t('pantry.noShopping')}</Text>
            {manage ? (
              <View className="flex-row flex-wrap gap-2">
                <Button label={t('pantry.createShopping')} onPress={() => void createShopping()} />
                {lists.length > 0 && (
                  <Button
                    variant="ghost"
                    label={t('pantry.chooseShopping')}
                    onPress={() => setChoosing(true)}
                  />
                )}
              </View>
            ) : (
              <Text className="text-sm text-ink-muted">{t('pantry.askManager')}</Text>
            )}
          </View>
        )}
        {toBuy > 0 && (
          <Text className="text-sm text-ink-muted">{t('pantry.toBuy', { count: toBuy })}</Text>
        )}
      </View>

      {writable && (
        <View className="flex-row">
          <Button label={t('pantry.add')} onPress={() => setEditing('new')} />
        </View>
      )}

      {items.data && sorted.length === 0 ? (
        <Text className={`text-ink-muted ${READABLE}`}>{t('pantry.empty')}</Text>
      ) : (
        <View>
          {sorted.map((item) => {
            const needs = pantryNeeds(item.qty, item.min_qty);
            const qty = `${formatQty(item.qty)}${item.unit ? ` ${item.unit}` : ''}`;
            return (
              <View
                key={item.id}
                accessibilityLabel={item.name}
                className="min-h-12 flex-row flex-wrap items-center gap-2 border-b border-line py-1"
              >
                <View className="min-w-32 flex-1">
                  <Text className="text-base text-ink">{item.name}</Text>
                  <Text className="text-xs text-ink-muted">
                    {needs
                      ? shopping
                        ? t('pantry.inShopping')
                        : t('pantry.needs')
                      : t('pantry.minimum', {
                          min: `${formatQty(item.min_qty)}${item.unit ? ` ${item.unit}` : ''}`,
                        })}
                  </Text>
                </View>
                {writable && (
                  <IconButton
                    icon={Minus}
                    label={t('pantry.less', { name: item.name })}
                    disabled={item.qty <= 0}
                    onPress={() => step(item, -1)}
                  />
                )}
                <Text
                  className={`min-w-14 text-center text-base ${needs ? 'text-accent' : 'text-ink'}`}
                  accessibilityLabel={t('pantry.qtyOf', { name: item.name, qty })}
                >
                  {qty}
                </Text>
                {writable && (
                  <>
                    <IconButton
                      icon={Plus}
                      label={t('pantry.more', { name: item.name })}
                      onPress={() => step(item, 1)}
                    />
                    <Button
                      variant="ghost"
                      label={t('pantry.out')}
                      accessibilityLabel={t('pantry.outOf', { name: item.name })}
                      disabled={item.qty <= 0}
                      onPress={() =>
                        actions.update.mutate({ id: item.id, qty: 0 }, { onError: fail })
                      }
                    />
                    <IconButton
                      icon={Pencil}
                      label={t('pantry.edit', { name: item.name })}
                      onPress={() => setEditing(item)}
                    />
                    <IconButton
                      icon={Trash2}
                      tone="danger"
                      label={t('pantry.remove', { name: item.name })}
                      onPress={() => setRemoving(item)}
                    />
                  </>
                )}
              </View>
            );
          })}
        </View>
      )}

      {editing && (
        <PantryForm
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(values) => {
            const current = editing;
            setEditing(null);
            if (current === 'new') {
              const last = Math.max(0, ...(items.data ?? []).map((i) => i.position));
              actions.create.mutate(
                { ...values, id: uuidv7(), position: last + 1 },
                { onError: fail },
              );
            } else {
              actions.update.mutate({ id: current.id, ...values }, { onError: fail });
            }
          }}
        />
      )}
      {choosing && (
        <ActionMenu
          title={t('pantry.chooseShopping')}
          onClose={() => setChoosing(false)}
          actions={[
            ...lists.map((p) => ({
              label: p.name,
              onPress: () => void setShopping(p.id).catch(fail),
            })),
            { label: t('pantry.createShopping'), onPress: () => void createShopping() },
          ]}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={t('pantry.removeTitle')}
          message={t('pantry.removeBody', { name: removing.name })}
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
  );
}

type Field = 'name' | 'unit' | 'qty' | 'min' | 'buy';

function PantryForm({
  item,
  onSave,
  onClose,
}: {
  item: PantryItem | null;
  onSave: (values: {
    name: string;
    unit: string;
    qty: number;
    min_qty: number;
    buy_qty: number;
  }) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<Field, string>>({
    name: item?.name ?? '',
    unit: item?.unit ?? '',
    qty: item ? formatQty(item.qty) : '0',
    min: item ? formatQty(item.min_qty) : '1',
    buy: item ? formatQty(item.buy_qty) : '1',
  });
  const qty = parseQty(values.qty);
  const min = parseQty(values.min);
  const buy = parseQty(values.buy);
  const valid = !!values.name.trim() && qty !== null && min !== null && buy !== null && buy > 0;
  const bad = !!values.name.trim() && !valid;

  function save() {
    if (!valid || qty === null || min === null || buy === null) return;
    onSave({ name: values.name.trim(), unit: values.unit.trim(), qty, min_qty: min, buy_qty: buy });
  }

  const field = (k: Field, label: string, max: number, extra: object = {}) => (
    <View className="gap-1">
      <Text className="text-sm text-ink-muted">{label}</Text>
      <Input
        accessibilityLabel={label}
        value={values[k]}
        maxLength={max}
        onChangeText={(text) => setValues((v) => ({ ...v, [k]: text }))}
        onSubmitEditing={save}
        {...extra}
      />
    </View>
  );

  return (
    <DialogFrame onClose={onClose}>
      <Text accessibilityRole="header" className="text-lg font-semibold text-ink">
        {item ? t('pantry.editTitle') : t('pantry.addTitle')}
      </Text>
      {field('name', t('pantry.name'), 120, { autoFocus: true })}
      <View className="flex-row gap-2">
        <View className="flex-1">
          {field('qty', t('pantry.qty'), 10, { keyboardType: 'decimal-pad' })}
        </View>
        <View className="flex-1">{field('unit', t('pantry.unit'), 20)}</View>
      </View>
      <View className="flex-row gap-2">
        <View className="flex-1">
          {field('min', t('pantry.min'), 10, { keyboardType: 'decimal-pad' })}
        </View>
        <View className="flex-1">
          {field('buy', t('pantry.buy'), 10, { keyboardType: 'decimal-pad' })}
        </View>
      </View>
      <Text className="text-xs text-ink-muted">{t('pantry.formHint')}</Text>
      {bad && <Text className="text-sm text-danger">{t('pantry.badQty')}</Text>}
      <View className="flex-row justify-end gap-2">
        <Button variant="ghost" label={t('common.cancel')} onPress={onClose} />
        <Button label={t('common.save')} onPress={save} disabled={!valid} />
      </View>
    </DialogFrame>
  );
}
