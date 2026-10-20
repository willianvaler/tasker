// Lista de compras gerada de um cardápio (PB4, D224). Cada prato é uma tarefa; os ingredientes são
// as subtarefas dele ou as linhas com marcador ("- ", "* ", "• ") nas notas. Ingredientes iguais
// viram uma linha só, somando a quantidade quando a unidade combina.

export type Unit = 'g' | 'ml' | 'un';
export type Ingredient = { name: string; key: string; qty: number | null; unit: Unit | null };

// Unidade escrita → unidade base e fator (kg vira g; l vira ml)
const UNITS: Record<string, [Unit, number]> = {
  g: ['g', 1],
  gr: ['g', 1],
  grama: ['g', 1],
  gramas: ['g', 1],
  gramos: ['g', 1],
  grams: ['g', 1],
  kg: ['g', 1000],
  kilo: ['g', 1000],
  kilos: ['g', 1000],
  quilo: ['g', 1000],
  quilos: ['g', 1000],
  ml: ['ml', 1],
  l: ['ml', 1000],
  litro: ['ml', 1000],
  litros: ['ml', 1000],
  liter: ['ml', 1000],
  liters: ['ml', 1000],
  un: ['un', 1],
  und: ['un', 1],
  unid: ['un', 1],
  unidade: ['un', 1],
  unidades: ['un', 1],
  unidad: ['un', 1],
  x: ['un', 1],
};

const CONNECTORS = new Set(['de', 'of', 'del']);

/** Chave para juntar iguais: minúsculas, sem acento, sem espaço repetido. */
export function ingredientKey(name: string) {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(text: string): number | null {
  const fraction = /^(\d+)\/(\d+)$/.exec(text);
  if (fraction) return Number(fraction[2]) ? Number(fraction[1]) / Number(fraction[2]) : null;
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "500 g de carne moída", "2 ovos", "1,5kg arroz", "sal a gosto", "3x pão". */
export function parseIngredient(raw: string): Ingredient | null {
  const text = raw.replace(/^\s*[-*•]\s*/, '').trim();
  if (!text) return null;
  const match = /^(\d+\/\d+|\d+(?:[.,]\d+)?)\s*(\p{L}+(?=\s|$))?\s*(.*)$/u.exec(text);
  if (match) {
    const qty = parseNumber(match[1]);
    const word = match[2]?.toLowerCase();
    const unit = word ? UNITS[word] : undefined;
    // Número seguido de palavra que não é unidade: a palavra é o começo do nome ("2 ovos")
    let rest = unit ? match[3] : `${match[2] ?? ''} ${match[3]}`;
    rest = rest.trim();
    const first = rest.split(' ')[0]?.toLowerCase();
    if (first && CONNECTORS.has(first)) rest = rest.slice(first.length).trim();
    if (qty !== null && rest) {
      return {
        name: rest,
        key: ingredientKey(rest),
        qty: unit ? qty * unit[1] : qty,
        unit: unit ? unit[0] : 'un',
      };
    }
  }
  return { name: text, key: ingredientKey(text), qty: null, unit: null };
}

/** Junta os iguais (mesma chave e unidade). Sem quantidade não soma; com e sem, ficam as duas. */
export function mergeIngredients(items: Ingredient[]): Ingredient[] {
  const merged = new Map<string, Ingredient>();
  for (const item of items) {
    const id = `${item.key}|${item.unit ?? ''}`;
    const prev = merged.get(id);
    if (!prev) merged.set(id, { ...item });
    else if (prev.qty !== null && item.qty !== null) prev.qty += item.qty;
  }
  return [...merged.values()];
}

const round = (n: number) => Math.round(n * 100) / 100;
const decimal = (n: number, locale: string) =>
  round(n).toLocaleString(locale, { maximumFractionDigits: 2 });

/** "Carne moída (800 g)", "Arroz (1,5 kg)", "Ovos (6)", "Sal". */
export function formatIngredient(item: Ingredient, locale = 'pt-BR') {
  const name = item.name.charAt(0).toUpperCase() + item.name.slice(1);
  if (item.qty === null || !item.unit) return name;
  const amount =
    item.unit === 'g'
      ? item.qty >= 1000
        ? `${decimal(item.qty / 1000, locale)} kg`
        : `${decimal(item.qty, locale)} g`
      : item.unit === 'ml'
        ? item.qty >= 1000
          ? `${decimal(item.qty / 1000, locale)} l`
          : `${decimal(item.qty, locale)} ml`
        : decimal(item.qty, locale);
  return `${name} (${amount})`;
}

type MenuTask = {
  id: string;
  parent_task_id: string | null;
  title: string;
  notes: string | null;
  status: string;
  position: number;
};

/** Linhas de ingrediente dos pratos: subtarefas (qualquer nível) e marcadores nas notas. */
export function ingredientLines(tasks: MenuTask[]) {
  const dishes = tasks.filter((t) => !t.parent_task_id).sort((a, b) => a.position - b.position);
  // Pratos já feitos ficam de fora, a menos que todos estejam feitos (a semana inteira de novo)
  const open = dishes.filter((d) => d.status !== 'done');
  const chosen = new Set((open.length ? open : dishes).map((d) => d.id));
  const parentOf = new Map(tasks.map((t) => [t.id, t.parent_task_id]));
  const dishOf = (id: string): string => {
    let at = id;
    for (let p = parentOf.get(at); p; p = parentOf.get(at)) at = p;
    return at;
  };
  const lines: string[] = [];
  for (const dish of dishes.filter((d) => chosen.has(d.id)))
    for (const line of (dish.notes ?? '').split('\n'))
      if (/^\s*[-*•]\s+\S/.test(line)) lines.push(line);
  const hasChildren = new Set(tasks.map((t) => t.parent_task_id).filter(Boolean));
  for (const task of [...tasks].sort((a, b) => a.position - b.position))
    // Só as folhas: uma subtarefa com subtarefas é um grupo ("Molho"), não um ingrediente
    if (task.parent_task_id && !hasChildren.has(task.id) && chosen.has(dishOf(task.id)))
      lines.push(task.title);
  return lines;
}

/** Texto da lista de compras (uma linha por item), pronto para a criação em lote. */
export function shoppingList(tasks: MenuTask[], locale = 'pt-BR') {
  const parsed = ingredientLines(tasks).flatMap((line) => parseIngredient(line) ?? []);
  return mergeIngredients(parsed)
    .map((item) => formatIngredient(item, locale))
    .join('\n');
}
