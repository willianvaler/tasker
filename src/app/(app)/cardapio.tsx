import { router } from 'expo-router';
import { List, Plus, ShoppingCart } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ShoppingDestination } from '@/components/shopping-destination';
import { Button, IconButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Grid } from '@/components/ui/grid';
import { Text } from '@/components/ui/text';
import { AddDishDialog, weekdayName } from '@/components/wellness/diet';
import { cn } from '@/lib/cn';
import { MEALS, WEEK_ORDER, weekGrid, type DietTask, type Meal } from '@/lib/diet';
import { weekdayOf } from '@/lib/parser/dates';
import { useDiet } from '@/lib/queries/diet';
import { useToday } from '@/lib/queries/profile';
import { shoppingList } from '@/lib/shopping';
import { useCanWrite } from '@/providers/write';

/**
 * Cardápio da semana (BE2, D275): um cartão por dia, com café, almoço, lanche e jantar. "+" põe um
 * prato (nome, refeição, dias, ingredientes); tocar no prato abre a tarefa. A lista de compras sai
 * dos ingredientes da semana; "Ver como lista" abre a lista comum, para arrastar e editar.
 */
export default function MenuScreen() {
  const { t, i18n } = useTranslation();
  const { page, tasks, loading } = useDiet();
  const today = useToday();
  const writable = useCanWrite(page?.folder_id, { offline: true });
  const [adding, setAdding] = useState<{ day: number; meal: Meal } | null>(null);
  const [shopping, setShopping] = useState(false);

  if (!loading && !page)
    return (
      <Screen size="medium">
        <ScreenHeader title={t('diet.pageName')} back />
        <EmptyState title={t('diet.missing')} hint={t('diet.missingHint')} />
      </Screen>
    );

  const { grid, loose } = weekGrid(tasks.data ?? []);
  const list = shoppingList(tasks.data ?? [], i18n.language);
  const todayDay = weekdayOf(today);
  const open = (dish: DietTask) => router.push({ pathname: '/task/[id]', params: { id: dish.id } });

  return (
    <Screen size="wide">
      <ScreenHeader
        title={t('diet.pageName')}
        back
        right={
          page && (
            <Button
              variant="ghost"
              icon={List}
              label={t('diet.asList')}
              onPress={() => router.push({ pathname: '/page/[id]', params: { id: page.id } })}
            />
          )
        }
      />
      <ScreenScroll contentContainerClassName="gap-6 pb-clear">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="flex-1 text-sm text-ink-muted">{t('diet.weekHint')}</Text>
          {list && (
            <Button
              variant="ghost"
              icon={ShoppingCart}
              label={t('shopping.menu')}
              onPress={() => setShopping(true)}
            />
          )}
        </View>
        <Grid breakpoints={[700, 1100, 1450]}>
          {WEEK_ORDER.map((day) => {
            const meals = grid.get(day);
            const isToday = day === todayDay;
            return (
              <View
                key={day}
                aria-label={weekdayName(i18n.language, day, 'long')}
                className={cn(
                  'gap-2 rounded-lg border bg-surface p-3',
                  isToday ? 'border-accent' : 'border-line',
                )}
              >
                <Text accessibilityRole="header" className="font-serif text-lg text-ink">
                  {weekdayName(i18n.language, day, 'long')}
                  {isToday ? (
                    <Text className="font-mono text-xs text-accent"> · {t('diet.todayTag')}</Text>
                  ) : null}
                </Text>
                {MEALS.map((meal) => (
                  <View key={meal} className="gap-1 border-t border-line pt-2">
                    <View className="flex-row items-center">
                      <Text className="flex-1 font-mono text-xs uppercase text-ink-muted">
                        {t(`diet.meals.${meal}`)}
                      </Text>
                      {writable && page && (
                        <IconButton
                          icon={Plus}
                          label={t('diet.addTo', {
                            meal: t(`diet.meals.${meal}`),
                            day: weekdayName(i18n.language, day, 'long'),
                          })}
                          onPress={() => setAdding({ day, meal })}
                        />
                      )}
                    </View>
                    {meals?.[meal].map((dish) => (
                      <Pressable
                        key={dish.id}
                        accessibilityRole="button"
                        accessibilityLabel={t('task.details', { title: dish.title })}
                        onPress={() => open(dish)}
                        className="rounded px-1 py-1 hover:bg-wash"
                      >
                        <Text
                          className={cn(
                            'text-sm',
                            dish.status === 'done' ? 'text-ink-muted' : 'text-ink',
                          )}
                        >
                          {dish.status === 'done' ? '✓ ' : ''}
                          {dish.title}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ))}
              </View>
            );
          })}
        </Grid>
        {loose.length > 0 && (
          <View className="gap-1">
            <Text className="font-mono text-xs uppercase text-ink-muted">{t('diet.noDay')}</Text>
            {loose.map((dish) => (
              <Pressable
                key={dish.id}
                accessibilityRole="button"
                accessibilityLabel={t('task.details', { title: dish.title })}
                onPress={() => open(dish)}
                className="py-1"
              >
                <Text className="text-sm text-ink">{dish.title}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScreenScroll>
      {adding && page && (
        <AddDishDialog
          pageId={page.id}
          day={adding.day}
          meal={adding.meal}
          onClose={() => setAdding(null)}
        />
      )}
      {shopping && page && (
        <ShoppingDestination page={page} text={list} onClose={() => setShopping(false)} />
      )}
    </Screen>
  );
}
