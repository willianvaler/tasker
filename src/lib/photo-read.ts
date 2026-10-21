import { PAYMENT_METHODS } from './expenses';
import { makeDate, type IsoDate } from './parser/dates';

// Leitura de foto (ESCOPO_V9 §2 e §3): o que a Edge Function `read-photo` devolve vem do OCR (nota,
// D254) ou de um modelo (lista) e é tratado como palpite. Aqui ele é conferido e vira rascunho; a pessoa confere e salva.

export type ReceiptDraft = {
  readable: boolean;
  description: string;
  amount_cents: number | null;
  spent_on: IsoDate;
  method: (typeof PAYMENT_METHODS)[number] | null;
  /** Chave de acesso da NFC-e (44 dígitos) */
  nfce_key: string | null;
  /** Id de categoria padrão (material, food...) sugerido pela leitura */
  category: string | null;
  items: { description: string; amount_cents: number }[];
};

const CATEGORY_IDS = ['material', 'labor', 'transport', 'food', 'lodging', 'services', 'other'];

const text = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** 12.5 → 1250; texto ("12,50") também; fora do razoável, null. */
export function toCents(v: unknown): number | null {
  const n =
    typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : Number.NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000_000) return null;
  return Math.round(n * 100);
}

/** Só os 44 dígitos da chave de acesso (a nota imprime em grupos de 4). */
export function nfceKey(v: unknown): string | null {
  const digits = typeof v === 'string' ? v.replace(/\D/g, '') : '';
  return digits.length === 44 ? digits : null;
}

/** Data da nota: "YYYY-MM-DD" válida e não no futuro (senão, hoje). */
function readDate(v: unknown, today: IsoDate): IsoDate {
  const m = typeof v === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim()) : null;
  const date = m ? makeDate(Number(m[1]), Number(m[2]), Number(m[3])) : null;
  return date && date <= today ? date : today;
}

export function normalizeReceipt(raw: unknown, today: IsoDate): ReceiptDraft {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const items = (Array.isArray(r.items) ? r.items : [])
    .map((it) => {
      const item = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>;
      return { description: text(item.description, 200), amount_cents: toCents(item.amount) };
    })
    .filter((it): it is { description: string; amount_cents: number } =>
      Boolean(it.description && it.amount_cents),
    )
    .slice(0, 100);
  // Sem total legível, a soma dos itens
  const total =
    toCents(r.total) ?? (items.length ? items.reduce((sum, it) => sum + it.amount_cents, 0) : null);
  const method = PAYMENT_METHODS.find((m) => m === r.payment_method) ?? null;
  const category =
    typeof r.category === 'string' && CATEGORY_IDS.includes(r.category) ? r.category : null;
  return {
    readable: r.readable !== false && (!!total || !!text(r.store, 200)),
    description: text(r.store, 200),
    amount_cents: total,
    spent_on: readDate(r.date, today),
    method,
    nfce_key: nfceKey(r.access_key),
    category,
    items,
  };
}

/** Linhas da lista de papel, prontas para a criação em lote. */
export function normalizeList(raw: unknown): string[] {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return (Array.isArray(r.lines) ? r.lines : [])
    .map((line) => text(line, 500).replace(/^([-*•·]|\d+[.)])\s+/, ''))
    .filter(Boolean)
    .slice(0, 200);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Bytes → base64 (sem depender do btoa, que nem todo motor JS tem). */
export function toBase64(bytes: Uint8Array) {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  if (i < bytes.length) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8);
    out += B64[n >> 18] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] + '=' : '==';
  }
  return out;
}
