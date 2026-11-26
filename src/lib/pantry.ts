/**
 * Despensa (CS4, D390): espelho das regras do servidor (`pantry_needs`, `pantry_buy_title`, na
 * migração `20270113000000_despensa.sql`). Quem põe na lista de compras e soma ao estoque é o
 * servidor; o app usa isto para mostrar "na lista de compras" antes do sync voltar. Mudou a regra?
 * Mude os dois, com os mesmos casos nos dois testes.
 */

export type PantryItem = {
  id: string;
  page_id: string;
  name: string;
  unit: string;
  qty: number;
  min_qty: number;
  buy_qty: number;
  position: number;
  shopping_task_id: string | null;
};

export const PANTRY_MAX = 1e6;

/** Acabou (0) ou ficou abaixo do mínimo */
export function pantryNeeds(qty: number, min: number): boolean {
  return qty <= 0 || qty < min;
}

/** O número como se escreve ("1,5", "10"), sem zeros à direita */
export function formatQty(n: number): string {
  return String(Math.round(n * 1000) / 1000).replace('.', ',');
}

/** Texto da tarefa de compra: "Arroz (5 kg)" */
export function pantryBuyTitle(name: string, buy: number, unit: string): string {
  const u = unit.trim();
  return `${name.trim()} (${formatQty(buy)}${u ? ` ${u}` : ''})`.slice(0, 500);
}

/** Quantidade digitada: vírgula ou ponto, de 0 até o máximo; senão null. */
export function parseQty(text: string): number | null {
  const s = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const v = Number(s);
  return v <= PANTRY_MAX ? v : null;
}

/** O que falta comprar primeiro, depois o resto, cada parte pela ordem da lista. */
export function sortPantry(items: PantryItem[]): PantryItem[] {
  return [...items].sort(
    (a, b) =>
      Number(pantryNeeds(b.qty, b.min_qty)) - Number(pantryNeeds(a.qty, a.min_qty)) ||
      a.position - b.position ||
      a.name.localeCompare(b.name),
  );
}
