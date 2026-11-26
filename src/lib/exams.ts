/**
 * Exames (SA4, D389): resultados digitados pela pessoa, agrupados por exame para o gráfico. Sem
 * interpretação: a faixa de referência é a que a pessoa digitou e aparece só como texto e como
 * faixa no gráfico, nunca como "alto", "baixo" ou cor de alerta.
 */
import type { IsoDate } from './parser/dates';

export type ExamResult = {
  id: string;
  day: IsoDate;
  name: string;
  value: number;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  note: string;
  file_path: string | null;
  file_mime: string | null;
};

export type ExamGroup = {
  key: string;
  /** Nome e unidade do resultado mais recente */
  name: string;
  unit: string;
  /** Do mais antigo para o mais recente */
  results: ExamResult[];
  latest: ExamResult;
};

export const EXAM_LIMITS = { name: 80, unit: 20, note: 500, abs: 1e9 } as const;

/** Mesmo exame com outra grafia ("Glicose", "glicose ", "GLICOSE") junta no mesmo gráfico. */
export function examKey(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

const byDay = (a: ExamResult, b: ExamResult) =>
  a.day < b.day ? -1 : a.day > b.day ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export function groupExams(results: ExamResult[]): ExamGroup[] {
  const groups = new Map<string, ExamResult[]>();
  for (const r of results) {
    const key = examKey(r.name);
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const sorted = [...list].sort(byDay);
      const latest = sorted[sorted.length - 1];
      return { key, name: latest.name.trim(), unit: latest.unit, results: sorted, latest };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Valor digitado: aceita vírgula ou ponto, negativo e milhar com ponto ("1.250,5"); senão null. */
export function parseExamValue(text: string): number | null {
  let s = text.trim().replace(/\s/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) && Math.abs(v) <= EXAM_LIMITS.abs ? v : null;
}

/** Faixa opcional: vazio é "sem faixa" (null), texto inválido é erro (undefined). */
export function parseOptionalValue(text: string): number | null | undefined {
  if (!text.trim()) return null;
  return parseExamValue(text) ?? undefined;
}

export function formatExamValue(value: number, locale = 'pt-BR'): string {
  return value.toLocaleString(locale, { maximumFractionDigits: 3 });
}

/** A faixa como a pessoa digitou: "70–99 mg/dL", "≥ 70 mg/dL", "≤ 99 mg/dL"; sem faixa, null. */
export function refText(
  low: number | null,
  high: number | null,
  unit: string,
  locale = 'pt-BR',
): string | null {
  const f = (v: number) => formatExamValue(v, locale);
  const u = unit.trim() ? ` ${unit.trim()}` : '';
  if (low != null && high != null) return `${f(low)}–${f(high)}${u}`;
  if (low != null) return `≥ ${f(low)}${u}`;
  if (high != null) return `≤ ${f(high)}${u}`;
  return null;
}

/** Limites do eixo do gráfico: os valores e a faixa (a do resultado mais recente), com folga. */
export function chartRange(group: ExamGroup): { min: number; max: number } {
  const values = group.results.map((r) => r.value);
  const { ref_low, ref_high } = group.latest;
  if (ref_low != null) values.push(ref_low);
  if (ref_high != null) values.push(ref_high);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = max === min ? Math.max(Math.abs(max) * 0.1, 1) : (max - min) * 0.1;
  return { min: min - pad, max: max + pad };
}
