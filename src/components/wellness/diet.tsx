import { router } from 'expo-router';
import { CalendarDays, ShoppingCart, Utensils } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ShoppingDestination } from '@/components/shopping-destination';
import { useToggleWithUndo } from '@/components/tasks/task-row';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Chip } from '@/components/ui/chip';
import { DialogFrame } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { ingredientList, MEALS, todaysMeals, WEEK_ORDER, type Meal } from '@/lib/diet';
import { shoppingList } from '@/lib/shopping';
import { useAddDish, useDiet, useStartDiet } from '@/lib/queries/diet';
import { useCompleteTree } from '@/lib/queries/tasks';
import { useToday } from '@/lib/queries/profile';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';
import { useCanWrite } from '@/providers/write';

/** Nome curto do dia da semana no idioma (0 = domingo). */
export function weekdayName(lang: string, day: number, style: 'short' | 'long' = 'short') {
  // 25/10/2026 é domingo: + day dias dá o dia pedido
  const name = new Intl.DateTimeFormat(lang, { weekday: style, timeZone: 'UTC' }).format(
    new Date(Date.UTC(2026, 9, 25 + day, 12)),
  );
  return name.charAt(0).toLocaleUpperCase(lang) + name.slice(1);
}

/**
 * Dieta no Bem-estar (BE2, D275): o que tem no cardápio para hoje, para marcar, e os atalhos para
 * o cardápio da semana e a lista de compras. Sem cardápio ainda, oferece montar um.
 */
export function DietSection() {
  const { t, i18n } = useTranslation();
  const { page, tasks, loading } = useDiet();
  const { start, pending } = useStartDiet();
  const today = useToday();
  const toggle = useToggleWithUndo();
  // Prato com ingredientes (subtarefas): comer conclui o galho inteiro; o servidor recusa concluir
  // a mãe com filhas abertas
  const completeTree = useCompleteTree();
  const online = useIsOnline();
  const writable = useCanWrite(page?.folder_id, { offline: true });
  const toast = useToast();
  const [shopping, setShopping] = useState(false);
  if (loading) return null;

  if (!page)
    return (
      <View className="gap-3">
        <SectionLabel title={t('diet.title')} />
        <Text className="text-sm text-ink-muted">{t('diet.intro')}</Text>
        <Button
          icon={Utensils}
          className="self-start"
          label={t('diet.start')}
          loading={pending}
          disabled={!online || pending}
          onPress={() =>
            start({ folder: t('diet.folder'), page: t('diet.pageName') }).then(
              () => router.push('/cardapio'),
              (err: Error) => toast({ message: t('diet.error', { message: err.message }) }),
            )
          }
        />
      </View>
    );

  const meals = todaysMeals(tasks.data ?? [], today);
  const list = shoppingList(tasks.data ?? [], i18n.language);
  return (
    <View className="gap-3">
      <SectionLabel title={t('diet.today')} count={meals.length ? String(meals.length) : ''} />
      {meals.length === 0 ? (
        <Text className="text-sm text-ink-muted">{t('diet.nothingToday')}</Text>
      ) : (
        meals.map(({ meal, dish }) => {
          const task = tasks.data?.find((x) => x.id === dish.id);
          if (!task) return null;
          const done = task.status === 'done';
          return (
            <View
              key={dish.id}
              className="min-h-11 flex-row items-center gap-2 border-b border-line"
            >
              <Checkbox
                checked={done}
                disabled={!writable}
                label={t(done ? 'task.reopen' : 'task.complete', { title: task.title })}
                onChange={(checked) => {
                  const openChildren = (tasks.data ?? []).some(
                    (x) => x.parent_task_id === task.id && x.status !== 'done',
                  );
                  if (checked && openChildren)
                    completeTree.mutateAsync(task.id).then(
                      () => toast({ message: t('task.done', { title: task.title }) }),
                      (err: Error) => toast({ message: t('diet.error', { message: err.message }) }),
                    );
                  else toggle(task, checked);
                }}
              />
              <Text className="w-24 font-mono text-xs uppercase text-ink-muted">
                {t(`diet.meals.${meal}`)}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('task.details', { title: task.title })}
                className="flex-1 py-2"
                onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
              >
                <Text className={done ? 'text-sm text-ink-muted' : 'text-sm text-ink'}>
                  {task.title}
                </Text>
              </Pressable>
            </View>
          );
        })
      )}
      <View className="flex-row flex-wrap gap-2">
        <Button
          variant="ghost"
          icon={CalendarDays}
          label={t('diet.week')}
          onPress={() => router.push('/cardapio')}
        />
        {list && (
          <Button
            variant="ghost"
            icon={ShoppingCart}
            label={t('shopping.menu')}
            onPress={() => setShopping(true)}
          />
        )}
      </View>
      {shopping && (
        <ShoppingDestination page={page} text={list} onClose={() => setShopping(false)} />
      )}
    </View>
  );
}

/** Prato novo: nome, refeição, dias da semana e ingredientes (um por linha). */
export function AddDishDialog({
  pageId,
  day,
  meal: initialMeal,
  onClose,
}: {
  pageId: string;
  day: number;
  meal: Meal;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const addDish = useAddDish();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [days, setDays] = useState<number[]>([day]);
  const [ingredients, setIngredients] = useState('');
  const valid = !!title.trim() && days.length > 0;

  function save() {
    if (!valid) return;
    addDish(pageId, {
      title: title.trim(),
      meal,
      days,
      ingredients: ingredientList(ingredients),
    }).catch((err: Error) => toast({ message: t('diet.error', { message: err.message }) }));
    onClose();
  }

  return (
    <DialogFrame onClose={onClose} wide>
      <Text accessibilityRole="header" className="text-lg font-semibold text-ink">
        {t('diet.newDish')}
      </Text>
      <Input
        autoFocus
        value={title}
        onChangeText={setTitle}
        maxLength={200}
        placeholder={t('diet.dishPlaceholder')}
        accessibilityLabel={t('diet.dishName')}
      />
      <View
        className="flex-row flex-wrap gap-2"
        accessibilityRole="radiogroup"
        accessibilityLabel={t('diet.meal')}
      >
        {MEALS.map((m) => (
          <Chip
            key={m}
            role="radio"
            label={t(`diet.meals.${m}`)}
            selected={meal === m}
            onPress={() => setMeal(m)}
          />
        ))}
      </View>
      <Text className="text-sm font-semibold text-ink">{t('diet.days')}</Text>
      <View className="flex-row flex-wrap gap-2">
        {WEEK_ORDER.map((d) => (
          <Chip
            key={d}
            role="checkbox"
            label={weekdayName(i18n.language, d)}
            selected={days.includes(d)}
            onPress={() =>
              setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]))
            }
          />
        ))}
      </View>
      <Input
        value={ingredients}
        onChangeText={setIngredients}
        multiline
        className="min-h-24"
        maxLength={4000}
        placeholder={t('diet.ingredientsPlaceholder')}
        accessibilityLabel={t('diet.ingredients')}
      />
      <View className="flex-row justify-end gap-2">
        <Button variant="ghost" label={t('common.cancel')} onPress={onClose} />
        <Button label={t('common.save')} disabled={!valid} onPress={save} />
      </View>
    </DialogFrame>
  );
}
