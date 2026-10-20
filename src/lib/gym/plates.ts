import type { WeightUnit } from './types';

// Anilhas por lado (AC9.1, V6 §8): que anilhas pôr de cada lado da barra para chegar à carga,
// com a barra e as anilhas que a pessoa tem (configuráveis no Perfil). Da mais pesada para a mais
// leve; quando não fecha exato, diz quanto faltou.

export const DEFAULT_BAR: Record<WeightUnit, number> = { kg: 20, lb: 45 };
export const DEFAULT_PLATES: Record<WeightUnit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
};

export type PlateResult = {
  /** Anilhas de um lado, da mais pesada para a mais leve */
  perSide: number[];
  /** Carga que dá para montar (barra + 2 × lado) */
  total: number;
  /** Quanto faltou para a carga pedida (0: exato) */
  missing: number;
  /** A carga é menor que a barra */
  belowBar: boolean;
};

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * `plates`: os pesos que existem; `pairs` (opcional): quantos pares de cada um há (sem limite se
 * não disser).
 */
export function platesPerSide(
  target: number,
  bar: number,
  plates: number[],
  pairs?: Record<number, number>,
): PlateResult {
  if (target < bar) return { perSide: [], total: bar, missing: r2(target - bar), belowBar: true };
  let side = r2((target - bar) / 2);
  const perSide: number[] = [];
  for (const plate of [...new Set(plates)].filter((p) => p > 0).sort((a, b) => b - a)) {
    let left = pairs?.[plate] ?? Infinity;
    while (left > 0 && side + 1e-9 >= plate) {
      perSide.push(plate);
      side = r2(side - plate);
      left--;
    }
  }
  const total = r2(bar + 2 * perSide.reduce((s, p) => s + p, 0));
  return { perSide, total, missing: r2(target - total), belowBar: false };
}

/** "20 + 10 + 2,5" (agrupando iguais: "2 × 20 + 2,5") */
export function plateLabel(perSide: number[], locale = 'pt-BR') {
  const fmt = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(v);
  const groups: { plate: number; count: number }[] = [];
  for (const p of perSide) {
    const last = groups[groups.length - 1];
    if (last?.plate === p) last.count++;
    else groups.push({ plate: p, count: 1 });
  }
  return groups
    .map((g) => (g.count > 1 ? `${g.count} × ${fmt(g.plate)}` : fmt(g.plate)))
    .join(' + ');
}

/** "25, 20, 2,5" → [25, 20, 2.5]; o que não for número fica de fora. */
export function parsePlates(text: string): number[] {
  return text
    .split(/[;\s]+|,(?!\d)/)
    .map((t) => Number(t.trim().replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0);
}
