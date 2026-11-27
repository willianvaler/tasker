/**
 * Receitas, compras e macros (SA5, D391). A receita é uma anotação com as propriedades de porções
 * e de ingredientes (uma lista, um por item: "500 g de carne moída"). Juntar várias na lista de
 * compras usa o leitor do PB4 (`lib/shopping.ts`): soma o que é da mesma dimensão (g com kg, mL com
 * L) e deixa as medidas caseiras (colher, xícara) como estão. Os macros por porção vêm só da tabela
 * nutricional da própria pessoa; o que não está nela aparece como "sem dados", nunca é estimado.
 */
import { parseCsv } from './import-apps';
import type { NoteProps, PropValue } from './note-props';
import {
  formatIngredient,
  ingredientKey,
  mergeIngredients,
  parseIngredient,
  type Ingredient,
} from './shopping';

export type Recipe = { servings: number | null; ingredients: string[] };

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/** Nomes da propriedade nos três idiomas (sem acento e sem caixa) */
const SERVINGS_KEYS = new Set([
  'porcoes',
  'porcao',
  'porciones',
  'porcion',
  'servings',
  'serves',
  'rendimento',
]);
const INGREDIENT_KEYS = new Set(['ingredientes', 'ingredients', 'ingrediente', 'ingredient']);

/** O nome da propriedade com que a receita nova nasce, por idioma */
export const RECIPE_PROPS: Record<string, { servings: string; ingredients: string }> = {
  'pt-BR': { servings: 'porções', ingredients: 'ingredientes' },
  en: { servings: 'servings', ingredients: 'ingredients' },
  es: { servings: 'porciones', ingredients: 'ingredientes' },
};

function propBy(props: NoteProps | null | undefined, keys: Set<string>): PropValue | undefined {
  for (const [k, v] of Object.entries(props ?? {})) if (keys.has(fold(k))) return v;
  return undefined;
}

/** A anotação é uma receita quando tem a propriedade de ingredientes. */
export function readRecipe(props: NoteProps | null | undefined): Recipe | null {
  const raw = propBy(props, INGREDIENT_KEYS);
  if (raw === undefined) return null;
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/\n|;/) : [];
  const ingredients = list.map((s) => String(s).trim()).filter(Boolean);
  const s = propBy(props, SERVINGS_KEYS);
  const n = typeof s === 'number' ? s : typeof s === 'string' ? Number(s.replace(',', '.')) : NaN;
  return { servings: Number.isFinite(n) && n > 0 ? n : null, ingredients };
}

/** Ingredientes da receita, com a quantidade ajustada para `servings` porções (se der para saber). */
export function scaledIngredients(recipe: Recipe, servings?: number | null): Ingredient[] {
  const factor = recipe.servings && servings && servings > 0 ? servings / recipe.servings : 1;
  return recipe.ingredients.flatMap((line) => {
    const item = parseIngredient(line);
    if (!item) return [];
    return [{ ...item, qty: item.qty === null ? null : item.qty * factor }];
  });
}

/** Texto da lista de compras de várias receitas (uma linha por item), para a criação em lote. */
export function recipesShopping(
  chosen: { recipe: Recipe; servings?: number | null }[],
  locale = 'pt-BR',
): string {
  const all = chosen.flatMap(({ recipe, servings }) => scaledIngredients(recipe, servings));
  return mergeIngredients(all)
    .map((i) => formatIngredient(i, locale))
    .join('\n');
}

// ---------- Macros ----------

export type FoodBasis = 'g' | 'ml' | 'un';
export type Food = {
  id: string;
  name: string;
  basis: FoodBasis;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};
export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

/** "ovos" acha "Ovo"; "tomates" acha "tomate"; "pães" fica como está */
function forms(key: string): string[] {
  const out = [key];
  if (key.endsWith('es')) out.push(key.slice(0, -2));
  if (key.endsWith('s')) out.push(key.slice(0, -1));
  return out;
}

/** O alimento da tabela para o ingrediente: mesmo nome (singular ou plural) e mesma base. */
export function findFood(item: Ingredient, foods: Food[]): Food | undefined {
  if (item.qty === null || !item.unit) return undefined;
  const wanted = new Set(forms(item.key));
  return foods.find(
    (f) => f.basis === item.unit && forms(ingredientKey(f.name)).some((k) => wanted.has(k)),
  );
}

export type RecipeMacros = {
  total: Macros;
  /** Por porção, quando a receita diz quantas porções rende */
  perServing: Macros | null;
  /** Ingredientes que ficaram de fora da conta (sem quantidade, sem alimento ou base diferente) */
  missing: string[];
  counted: number;
};

export function recipeMacros(recipe: Recipe, foods: Food[]): RecipeMacros {
  const total = { ...ZERO };
  const missing: string[] = [];
  let counted = 0;
  for (const line of recipe.ingredients) {
    const item = parseIngredient(line);
    if (!item) continue;
    const food = findFood(item, foods);
    if (!food || item.qty === null) {
      missing.push(item.name);
      continue;
    }
    const factor = food.basis === 'un' ? item.qty : item.qty / 100;
    total.kcal += food.kcal * factor;
    total.protein += food.protein * factor;
    total.carbs += food.carbs * factor;
    total.fat += food.fat * factor;
    counted += 1;
  }
  const per = recipe.servings
    ? {
        kcal: total.kcal / recipe.servings,
        protein: total.protein / recipe.servings,
        carbs: total.carbs / recipe.servings,
        fat: total.fat / recipe.servings,
      }
    : null;
  return { total, perServing: per, missing, counted };
}

// ---------- CSV da tabela nutricional ----------

export type FoodInput = Omit<Food, 'id'>;

const HEADERS: Record<keyof FoodInput, string[]> = {
  name: ['nome', 'name', 'nombre', 'alimento', 'food'],
  basis: ['base', 'basis', 'por', 'per', 'unidade', 'unit', 'unidad'],
  kcal: ['kcal', 'calorias', 'calories', 'energia', 'energy'],
  protein: ['proteina', 'proteinas', 'protein', 'proteins'],
  carbs: ['carboidrato', 'carboidratos', 'carbs', 'carbohydrates', 'carbohidratos', 'carbohidrato'],
  fat: ['gordura', 'gorduras', 'fat', 'fats', 'grasa', 'grasas', 'lipidios'],
};
const ORDER: (keyof FoodInput)[] = ['name', 'basis', 'kcal', 'protein', 'carbs', 'fat'];

export function parseBasis(text: string): FoodBasis | null {
  const s = fold(text).replace(/\s/g, '');
  if (['g', '100g', 'grama', 'gramas', 'gramos', 'grams'].includes(s)) return 'g';
  if (['ml', '100ml'].includes(s)) return 'ml';
  if (['un', 'unidade', 'unidad', 'unit', 'u', '1un', 'porcao', 'porcion'].includes(s)) return 'un';
  return null;
}

/** Número com vírgula ou ponto, de 0 até 100 mil; vazio é 0. */
export function parseNutrient(text: string): number | null {
  const s = text.trim().replace(',', '.');
  if (!s) return 0;
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const v = Number(s);
  return v <= 100000 ? v : null;
}

/**
 * Linhas do CSV (`;` ou `,`): com cabeçalho em pt, en ou es, as colunas vêm dele; sem cabeçalho, a
 * ordem é nome, base, kcal, proteína, carboidrato, gordura. Linha que não fecha é contada como erro.
 */
export function parseFoodsCsv(text: string): { foods: FoodInput[]; skipped: number } {
  const rows = parseCsv(text);
  if (rows.length === 0) return { foods: [], skipped: 0 };
  const head = rows[0].map(fold);
  const index: Partial<Record<keyof FoodInput, number>> = {};
  for (const key of ORDER) {
    const i = head.findIndex((h) => HEADERS[key].includes(h.replace(/\s*\(.*\)$/, '')));
    if (i >= 0) index[key] = i;
  }
  const hasHeader = index.name !== undefined;
  const col = (key: keyof FoodInput) => (hasHeader ? index[key] : ORDER.indexOf(key));
  const foods: FoodInput[] = [];
  let skipped = 0;
  for (const row of hasHeader ? rows.slice(1) : rows) {
    const cell = (key: keyof FoodInput) => {
      const i = col(key);
      return i === undefined ? '' : (row[i] ?? '').trim();
    };
    const name = cell('name').slice(0, 80);
    const basis = cell('basis') ? parseBasis(cell('basis')) : 'g';
    const values = (['kcal', 'protein', 'carbs', 'fat'] as const).map((k) =>
      parseNutrient(cell(k)),
    );
    if (!name || !basis || values.some((v) => v === null)) {
      skipped += 1;
      continue;
    }
    const [kcal, protein, carbs, fat] = values as number[];
    foods.push({ name, basis, kcal, protein, carbs, fat });
  }
  return { foods, skipped };
}

/** Macro para mostrar: kcal inteiro, gramas com uma casa. */
export function formatMacros(m: Macros, locale = 'pt-BR') {
  const g = (n: number) =>
    (Math.round(n * 10) / 10).toLocaleString(locale, { maximumFractionDigits: 1 });
  return {
    kcal: Math.round(m.kcal).toLocaleString(locale),
    protein: g(m.protein),
    carbs: g(m.carbs),
    fat: g(m.fat),
  };
}
