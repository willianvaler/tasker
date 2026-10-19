import { addDays, makeDate, type IsoDate } from './parser/dates';

// Gastos (ESCOPO_V9): funções puras da página de gastos. Valor sempre em centavos inteiros;
// a tela só formata. Os totais do servidor (export_my_data, planilhas) usam a mesma conta.

export type ExpenseKind = 'out' | 'in';

export type ExpenseLike = {
  spent_on: string;
  amount_cents: number;
  kind: string;
  category: string | null;
};

/** Categorias iniciais (ids; o nome vem do i18n). Dá para usar qualquer outra. */
export const DEFAULT_CATEGORIES = [
  'material',
  'labor',
  'transport',
  'food',
  'lodging',
  'services',
  'other',
] as const;

export const PAYMENT_METHODS = ['pix', 'card', 'cash', 'transfer', 'boleto'] as const;

/** Maior valor aceito (o mesmo limite do banco: R$ 1 bilhão). */
export const MAX_CENTS = 100_000_000_000;

/**
 * "1.234,56", "R$ 12,50", "12.5", "1,234.56", "40" → centavos. Com um separador só, ele é decimal
 * quando vem seguido de 1 ou 2 dígitos ("12,5", "12.50") e de milhar quando vem de 3 ("1.234");
 * com os dois, o último é o decimal. Vazio, zero, negativo ou estranho: null.
 */
export function parseMoney(text: string): number | null {
  const clean = text.replace(/[^\d.,]/g, '');
  if (!/\d/.test(clean)) return null;
  const lastDot = clean.lastIndexOf('.');
  const lastComma = clean.lastIndexOf(',');
  let integer = clean;
  let decimals = '';
  if (lastDot >= 0 && lastComma >= 0) {
    const at = Math.max(lastDot, lastComma);
    integer = clean.slice(0, at);
    decimals = clean.slice(at + 1);
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const parts = clean.split(sep);
    const tail = parts[parts.length - 1];
    if (parts.length === 2 && tail.length >= 1 && tail.length <= 2) {
      integer = parts[0];
      decimals = tail;
    }
  }
  // Milhar de verdade: depois do primeiro, todo grupo tem 3 dígitos ("12,345,6" não é valor)
  const groups = integer.split(/[.,]/);
  if (groups.slice(1).some((g) => g.length !== 3)) return null;
  integer = groups.join('');
  if (!/^\d*$/.test(decimals) || decimals.length > 2) return null;
  const cents = Number(integer || '0') * 100 + Number(decimals.padEnd(2, '0') || '0');
  return Number.isSafeInteger(cents) && cents >= 1 && cents <= MAX_CENTS ? cents : null;
}

/** Centavos → "R$ 1.234,56" no idioma. */
export function formatMoney(cents: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

/** Centavos → "1234,56" (para editar: sem símbolo nem separador de milhar). */
export function moneyInput(cents: number, decimalComma: boolean) {
  const text = (cents / 100).toFixed(2);
  return decimalComma ? text.replace('.', ',') : text;
}

/** Moeda padrão do idioma (a página pode ter lançamentos em outra). */
export function defaultCurrency(language: string) {
  if (language.startsWith('pt')) return 'BRL';
  if (language.startsWith('es')) return 'EUR';
  return 'USD';
}

/**
 * Data digitada: "hoje", "ontem", "12/10", "12/10/2026", "12-10-26", "2026-10-12" (e "today",
 * "yesterday", "hoy", "ayer"). Dia antes do mês, como no resto do app em pt/es; em en, o mês vem
 * antes. Estranho: null.
 */
export function parseExpenseDate(text: string, today: IsoDate, monthFirst = false): IsoDate | null {
  const v = text.trim().toLowerCase();
  if (!v || ['hoje', 'today', 'hoy'].includes(v)) return today;
  if (['ontem', 'yesterday', 'ayer'].includes(v)) return addDays(today, -1);
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) return makeDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/.exec(v);
  if (!m) return null;
  const [a, b] = [Number(m[1]), Number(m[2])];
  const [day, month] = monthFirst ? [b, a] : [a, b];
  const year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : Number(today.slice(0, 4));
  return makeDate(year, month, day);
}

export type ExpensePeriod = 'month' | 'all';

/** Lançamentos do período: o mês de `today` ou todos. */
export function inPeriod<T extends ExpenseLike>(list: T[], period: ExpensePeriod, today: IsoDate) {
  if (period === 'all') return list;
  const month = today.slice(0, 7);
  return list.filter((e) => e.spent_on.slice(0, 7) === month);
}

export type ExpenseSummary = {
  /** Saídas */
  spent: number;
  /** Entradas */
  received: number;
  /** Entradas − saídas */
  balance: number;
  /** Saídas por categoria, da maior para a menor ("" = sem categoria) */
  byCategory: { category: string; cents: number }[];
  count: number;
};

export function summarize(list: ExpenseLike[]): ExpenseSummary {
  let spent = 0;
  let received = 0;
  const categories = new Map<string, number>();
  for (const e of list) {
    if (e.kind === 'in') {
      received += e.amount_cents;
      continue;
    }
    spent += e.amount_cents;
    const key = e.category ?? '';
    categories.set(key, (categories.get(key) ?? 0) + e.amount_cents);
  }
  const byCategory = [...categories]
    .map(([category, cents]) => ({ category, cents }))
    .sort((a, b) => b.cents - a.cents || a.category.localeCompare(b.category));
  return { spent, received, balance: received - spent, byCategory, count: list.length };
}

/** Quanto do orçamento já foi (0 a 1+; acima de 1 estourou). Sem orçamento, null. */
export function budgetUsed(spent: number, budget: number | null | undefined) {
  return budget && budget > 0 ? spent / budget : null;
}

/** Categorias para sugerir: as já usadas na página (mais usadas primeiro) e depois as padrão. */
export function categorySuggestions(list: ExpenseLike[], defaults: string[]) {
  const used = new Map<string, number>();
  for (const e of list) if (e.category) used.set(e.category, (used.get(e.category) ?? 0) + 1);
  const ranked = [...used].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const seen = new Set(ranked.map((c) => c.toLocaleLowerCase()));
  return [...ranked, ...defaults.filter((c) => !seen.has(c.toLocaleLowerCase()))];
}

/** Ordem da planilha: mais recente primeiro; no mesmo dia, o lançado por último primeiro. */
export function byDateDesc<T extends { spent_on: string; created_at: string }>(a: T, b: T) {
  return b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at);
}

/** "2026-10-12" → "12/10/2026" (em en, "10/12/2026"): o que o campo de data mostra para editar. */
export function dateInput(date: IsoDate, monthFirst = false) {
  const [y, m, d] = date.split('-');
  return monthFirst ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
}
