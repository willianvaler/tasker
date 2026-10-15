import { formatShortDate, type IsoDate } from './parser/dates';

// Campos personalizados (M5, D142): ler o que se digita e mostrar o valor guardado. Puro.

export const FIELD_KINDS = ['text', 'number', 'select', 'date', 'person', 'money'] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];
export type FieldValue = string | number | null;

/** O que se digitou → valor guardado (null = vazio; undefined = não entendi). */
export function parseFieldInput(kind: FieldKind, text: string): FieldValue | undefined {
  const s = text.trim();
  if (!s) return null;
  if (kind === 'number' || kind === 'money') {
    // "1.200,50" e "1200.5"
    const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
    const n = Number(normalized.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) && /\d/.test(s) ? n : undefined;
  }
  if (kind === 'date') {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s) ?? /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return undefined;
    const [y, mo, d] = s.includes('-') ? [m[1], m[2], m[3]] : [m[3], m[2], m[1]];
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return s.slice(0, 200);
}

/** Valor guardado → texto curto ("R$ 1.200,00", "15 out", "Ana"). */
export function formatFieldValue(
  kind: FieldKind,
  value: unknown,
  locale = 'pt-BR',
  people?: ReadonlyMap<string, string>,
): string {
  if (value == null || value === '') return '';
  if (kind === 'money')
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: locale === 'en' ? 'USD' : locale === 'es' ? 'EUR' : 'BRL',
    }).format(Number(value));
  if (kind === 'number') return new Intl.NumberFormat(locale).format(Number(value));
  if (kind === 'date') return formatShortDate(String(value) as IsoDate);
  if (kind === 'person') return people?.get(String(value)) ?? String(value);
  return String(value);
}
