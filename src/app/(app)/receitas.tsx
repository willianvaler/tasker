import { router } from 'expo-router';
import { Plus, ShoppingCart, Table2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { READABLE, Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ActionMenu, type MenuAction } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { setBatchDraft } from '@/lib/batch-draft';
import { noteTitle, useNoteMutations, useNotes } from '@/lib/queries/notes';
import { useFoods } from '@/lib/queries/nutrition';
import { pageLabel, useTree } from '@/lib/queries/tree';
import {
  formatMacros,
  readRecipe,
  RECIPE_PROPS,
  recipeMacros,
  recipesShopping,
  type Recipe,
} from '@/lib/recipes';
import { useToast } from '@/providers/toast';

// Receitas (SA5, D391): as anotações com a propriedade de ingredientes. Os macros por porção vêm
// só da tabela nutricional da pessoa (/nutricao); escolher várias e juntar na lista de compras
// abre a criação em lote, como o cardápio (PB4), com as quantidades ajustadas às porções.
export default function RecipesScreen() {
  const { t, i18n } = useTranslation();
  const notes = useNotes();
  const foods = useFoods();
  const m = useNoteMutations();
  const tree = useTree();
  const toast = useToast();
  // Escolhidas: id → porções digitadas (texto)
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [where, setWhere] = useState(false);

  const recipes = (notes.data ?? []).flatMap((n) => {
    const recipe = readRecipe(n.props);
    return recipe ? [{ note: n, recipe }] : [];
  });
  recipes.sort((a, b) => noteTitle(a.note, '').localeCompare(noteTitle(b.note, '')));
  const picked = recipes.filter((r) => r.note.id in chosen);
  const servingsOf = (id: string, recipe: Recipe) => {
    const n = Number((chosen[id] ?? '').replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : recipe.servings;
  };
  const text = recipesShopping(
    picked.map((r) => ({ recipe: r.recipe, servings: servingsOf(r.note.id, r.recipe) })),
    i18n.language,
  );

  async function create() {
    const names = RECIPE_PROPS[i18n.language] ?? RECIPE_PROPS['pt-BR'];
    try {
      const id = await m.create.mutateAsync({
        title: t('recipes.newTitle'),
        body: t('recipes.newBody'),
        props: { [names.servings]: 2, [names.ingredients]: [] },
      });
      router.push({ pathname: '/nota/[id]', params: { id } });
    } catch (e) {
      toast({ message: (e as Error).message });
    }
  }

  const lists = (tree.data?.pages ?? []).filter(
    (p) => p.view_type === 'list' && !p.is_inbox && !p.is_habits,
  );
  const open = (pageId: string) => {
    setBatchDraft(pageId, text);
    router.push('/batch');
  };
  const destinations: MenuAction[] = [
    ...lists.map((p) => ({ label: pageLabel(p), onPress: () => open(p.id) })),
    ...(tree.data?.inbox
      ? [{ label: t('nav.inbox'), onPress: () => open(tree.data?.inbox?.id ?? '') }]
      : []),
  ];

  const g = (v: string) => t('recipes.grams', { value: v });

  return (
    <Screen size="medium">
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="gap-6 pb-clear">
        <ScreenHeader back help="bem-estar" title={t('recipes.title')} />
        <View className="flex-row flex-wrap gap-2">
          <Button icon={Plus} label={t('recipes.new')} onPress={() => void create()} />
          <Button
            variant="ghost"
            icon={Table2}
            label={t('nutrition.title')}
            onPress={() => router.push('/nutricao')}
          />
        </View>

        {notes.data && recipes.length === 0 ? (
          <View className={`gap-2 ${READABLE}`}>
            <Text className="text-ink">{t('recipes.empty')}</Text>
            <Text className="font-mono text-sm text-ink-muted">{t('recipes.syntax')}</Text>
          </View>
        ) : (
          <View>
            {recipes.map(({ note, recipe }) => {
              const title = noteTitle(note, t('notes.untitled'));
              const macros = recipeMacros(recipe, foods.data ?? []);
              const shown = formatMacros(macros.perServing ?? macros.total, i18n.language);
              const selected = note.id in chosen;
              return (
                <View key={note.id} className="gap-2 border-b border-line py-3">
                  <View className="flex-row items-start gap-3">
                    <Checkbox
                      checked={selected}
                      label={t('recipes.pick', { title })}
                      onChange={(on) =>
                        setChosen((c) => {
                          const next = { ...c };
                          if (on) next[note.id] = recipe.servings ? String(recipe.servings) : '';
                          else delete next[note.id];
                          return next;
                        })
                      }
                    />
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={t('recipes.open', { title })}
                      className="flex-1 gap-1"
                      onPress={() =>
                        router.push({ pathname: '/nota/[id]', params: { id: note.id } })
                      }
                    >
                      <Text className="font-serif text-lg text-ink">{title}</Text>
                      <Text className="text-sm text-ink-muted">
                        {recipe.servings
                          ? t('recipes.servings', { count: recipe.servings })
                          : t('recipes.noServings')}
                        {' · '}
                        {t('recipes.ingredients', { count: recipe.ingredients.length })}
                      </Text>
                      {macros.counted > 0 && (
                        <Text className="text-sm text-ink">
                          {t(macros.perServing ? 'recipes.perServing' : 'recipes.total', {
                            kcal: shown.kcal,
                            protein: g(shown.protein),
                            carbs: g(shown.carbs),
                            fat: g(shown.fat),
                          })}
                        </Text>
                      )}
                      {macros.missing.length > 0 && (foods.data?.length ?? 0) > 0 && (
                        <Text className="text-xs text-ink-muted">
                          {t('recipes.missing', { list: macros.missing.join(', ') })}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                  {selected && (
                    <View className="ml-12 flex-row items-center gap-2">
                      <Text className="text-sm text-ink-muted">{t('recipes.make')}</Text>
                      <Input
                        className="w-20"
                        accessibilityLabel={t('recipes.makeOf', { title })}
                        keyboardType="decimal-pad"
                        maxLength={5}
                        value={chosen[note.id]}
                        onChangeText={(v) => setChosen((c) => ({ ...c, [note.id]: v }))}
                      />
                      <Text className="text-sm text-ink-muted">{t('recipes.portions')}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {recipes.length > 0 && (foods.data?.length ?? 0) === 0 && (
          <Text className={`text-sm text-ink-muted ${READABLE}`}>{t('recipes.noFoods')}</Text>
        )}

        {recipes.length > 0 && (
          <View className="flex-row">
            <Button
              icon={ShoppingCart}
              label={t('recipes.toShopping', { count: picked.length })}
              disabled={picked.length === 0 || !text}
              onPress={() => setWhere(true)}
            />
          </View>
        )}

        {where && (
          <ActionMenu
            title={t('shopping.where')}
            actions={destinations}
            onClose={() => setWhere(false)}
          />
        )}
      </ScreenScroll>
    </Screen>
  );
}
