/**
 * Repetição espaçada (ET1, D386): SM-2 modificado (V15-9), espelho de `public._card_state`
 * (migração `20270110000000_cartoes.sql`). O estado de um cartão é sempre derivado do log de
 * revisões em ordem de horário, então dois aparelhos que revisaram fora de ordem chegam ao mesmo
 * estado. Mudou a regra? Mude os dois, com os mesmos casos nos dois testes.
 */

import { addDays } from './parser/dates';

export type Card = {
  id: string;
  note_id: string;
  question: string;
  answer: string;
  position: number;
};

export type CardReview = {
  id: string;
  card_id: string;
  grade: number;
  /** Dia 'YYYY-MM-DD' (fuso do perfil) em que revisou */
  day: string;
  reviewed_at: string;
};

export type CardState = {
  reps: number;
  lapses: number;
  /** Facilidade em centésimos (250 = 2,5) */
  ease: number;
  interval: number;
  due: string;
  lastDay: string;
  reviews: number;
};

export const EASE_START = 250;
export const EASE_MIN = 130;
export const INTERVAL_MAX = 3650;
/** Limites do dia (V15 §6): novos e revisões, ajustáveis em `ui_prefs.srs` */
export const SRS_LIMITS = { newPerDay: 20, reviewsPerDay: 200 } as const;
export const SRS_LIMIT_MAX = 9999;

/** As quatro respostas da tela e a nota de cada uma (0–5 no log). */
export const GRADES = [
  { grade: 1, key: 'again' },
  { grade: 3, key: 'hard' },
  { grade: 4, key: 'good' },
  { grade: 5, key: 'easy' },
] as const;

const byTime = (a: CardReview, b: CardReview) =>
  a.reviewed_at < b.reviewed_at ? -1 : a.reviewed_at > b.reviewed_at ? 1 : a.id < b.id ? -1 : 1;

/** Estado de um cartão a partir das revisões dele (qualquer ordem); null sem revisão. */
export function cardState(reviews: CardReview[]): CardState | null {
  if (reviews.length === 0) return null;
  let reps = 0;
  let lapses = 0;
  let ease = EASE_START;
  let interval = 0;
  let last = '';
  for (const r of [...reviews].sort(byTime)) {
    last = r.day;
    const miss = 5 - r.grade;
    const delta = 10 - miss * (8 + miss * 2);
    if (r.grade < 3) {
      ease = Math.max(EASE_MIN, ease + Math.max(delta, -20));
      reps = 0;
      lapses += 1;
      interval = 1;
    } else {
      ease = Math.max(EASE_MIN, ease + delta);
      reps += 1;
      interval =
        reps === 1
          ? 1
          : reps === 2
            ? 6
            : Math.min(
                INTERVAL_MAX,
                Math.max(interval + 1, Math.floor((interval * ease + 50) / 100)),
              );
    }
  }
  return {
    reps,
    lapses,
    ease,
    interval,
    due: addDays(last, interval),
    lastDay: last,
    reviews: reviews.length,
  };
}

/** Estado de todos os cartões de uma vez (as revisões de todos misturadas). */
export function cardStates(reviews: CardReview[]): Record<string, CardState> {
  const groups: Record<string, CardReview[]> = {};
  for (const r of reviews) (groups[r.card_id] ??= []).push(r);
  const out: Record<string, CardState> = {};
  for (const [id, list] of Object.entries(groups)) {
    const s = cardState(list);
    if (s) out[id] = s;
  }
  return out;
}

export type SrsLimits = { newPerDay: number; reviewsPerDay: number };

export type SrsQueue = {
  /** Cartões vencidos (até hoje), do mais atrasado, dentro do que sobra do limite */
  due: Card[];
  /** Cartões nunca revisados, na ordem da anotação, dentro do que sobra do limite */
  fresh: Card[];
  /** Quantos estão vencidos e quantos são novos ao todo, sem limite */
  dueTotal: number;
  freshTotal: number;
  /** Já feitos hoje: cartões novos vistos e revisões de cartões antigos */
  newDone: number;
  reviewsDone: number;
};

/**
 * Fila do dia. Novo é cartão sem revisão; o que teve a primeira revisão hoje conta no limite dos
 * novos. Revisão é cartão antigo vencido; o que já foi revisto hoje conta no limite das revisões.
 */
export function srsQueue(
  cards: Card[],
  reviews: CardReview[],
  today: string,
  limits: SrsLimits,
): SrsQueue {
  const states = cardStates(reviews);
  const first: Record<string, string> = {};
  const doneToday = new Set<string>();
  for (const r of reviews) {
    if (!first[r.card_id] || r.day < first[r.card_id]) first[r.card_id] = r.day;
    if (r.day === today) doneToday.add(r.card_id);
  }
  let newDone = 0;
  let reviewsDone = 0;
  for (const id of doneToday) {
    if (first[id] === today) newDone += 1;
    else reviewsDone += 1;
  }
  const due = cards
    .filter((c) => states[c.id] && states[c.id].due <= today)
    .sort((a, b) =>
      states[a.id].due < states[b.id].due ? -1 : states[a.id].due > states[b.id].due ? 1 : 0,
    );
  const fresh = cards.filter((c) => !states[c.id]);
  return {
    due: due.slice(0, Math.max(0, limits.reviewsPerDay - reviewsDone)),
    fresh: fresh.slice(0, Math.max(0, limits.newPerDay - newDone)),
    dueTotal: due.length,
    freshTotal: fresh.length,
    newDone,
    reviewsDone,
  };
}

/** Limites salvos (ou os padrões), sempre inteiros de 0 a 9999. */
export function readSrsLimits(raw: unknown): SrsLimits {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const pick = (v: unknown, d: number) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= SRS_LIMIT_MAX ? v : d;
  return {
    newPerDay: pick(o.newPerDay, SRS_LIMITS.newPerDay),
    reviewsPerDay: pick(o.reviewsPerDay, SRS_LIMITS.reviewsPerDay),
  };
}

/** Próxima data se responder com esta nota agora (para mostrar "1 d", "6 d" no botão). */
export function nextInterval(reviews: CardReview[], grade: number, today: string): number {
  const probe: CardReview = {
    id: '￿',
    card_id: '',
    grade,
    day: today,
    reviewed_at: '￿',
  };
  return cardState([...reviews, probe])?.interval ?? 1;
}

/**
 * Sessões de estudo do dia (ET2, D388), a mesma conta do `_study_session` do servidor (quem dá o XP
 * é ele): cada `size` cartões diferentes revisados no dia fecham uma sessão, até `cap`.
 */
export function studySessions(
  reviews: CardReview[],
  today: string,
  size: number,
  cap: number,
): { sessions: number; inSession: number; capped: boolean } {
  const cards = new Set(reviews.filter((r) => r.day === today).map((r) => r.card_id)).size;
  const sessions = Math.min(cap, Math.floor(cards / size));
  return { sessions, inSession: cards % size, capped: sessions >= cap };
}
