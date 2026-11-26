import { describe, expect, it } from '@jest/globals';

import {
  cardState,
  nextInterval,
  readSrsLimits,
  srsQueue,
  type Card,
  type CardReview,
} from '../srs';

const rev = (id: string, card: string, grade: number, day: string): CardReview => ({
  id,
  card_id: card,
  grade,
  day,
  reviewed_at: `${day}T10:00:00Z`,
});
const card = (id: string, position = 0): Card => ({
  id,
  note_id: 'n',
  question: `q${id}`,
  answer: 'a',
  position,
});

// Os mesmos casos de supabase/tests/cartoes.test.sql
describe('cardState (SM-2 modificado, espelho de _card_state)', () => {
  const ok = [
    rev('f2', 'c', 4, '2026-11-02'),
    rev('f1', 'c', 4, '2026-11-01'),
    rev('f3', 'c', 5, '2026-11-08'),
  ];

  it('três acertos: 1, 6 e 6 × 2,6 = 16 dias, em qualquer ordem de chegada', () => {
    const s = cardState(ok);
    expect(s).toMatchObject({ reps: 3, ease: 260, interval: 16, due: '2026-11-24' });
    expect(cardState([...ok].reverse())).toEqual(s);
  });

  it('errar volta a 1 dia e tira no máximo 0,20', () => {
    expect(cardState([...ok, rev('f4', 'c', 0, '2026-11-24')])).toMatchObject({
      reps: 0,
      lapses: 1,
      ease: 240,
      interval: 1,
      due: '2026-11-25',
    });
  });

  it('a facilidade não passa abaixo de 1,3', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      rev(`r${String(i).padStart(2, '0')}`, 'c', 3, `2026-01-${String(i + 1).padStart(2, '0')}`),
    );
    expect(cardState(many)?.ease).toBe(130);
  });

  it('sem revisão não tem estado', () => {
    expect(cardState([])).toBeNull();
  });

  it('nextInterval mostra o que cada botão daria', () => {
    expect(nextInterval([], 4, '2026-11-01')).toBe(1);
    expect(nextInterval([rev('a', 'c', 4, '2026-11-01')], 4, '2026-11-02')).toBe(6);
    expect(nextInterval([rev('a', 'c', 4, '2026-11-01')], 1, '2026-11-02')).toBe(1);
  });
});

describe('srsQueue', () => {
  const today = '2026-11-10';
  const cards = [card('a', 1), card('b', 2), card('c', 3), card('d', 4)];

  it('vencidos e novos, com os limites do dia', () => {
    const reviews = [
      rev('1', 'a', 4, '2026-11-01'),
      rev('2', 'b', 4, '2026-11-08'),
      rev('3', 'b', 4, '2026-11-09'),
    ];
    // a venceu em 02/11; b só em 15/11
    const q = srsQueue(cards, reviews, today, { newPerDay: 1, reviewsPerDay: 200 });
    expect(q.due.map((c) => c.id)).toEqual(['a']);
    expect(q.fresh.map((c) => c.id)).toEqual(['c']);
    expect(q.freshTotal).toBe(2);
  });

  it('o que já foi feito hoje desconta do limite', () => {
    const reviews = [
      rev('1', 'c', 4, today),
      rev('2', 'a', 4, '2026-11-01'),
      rev('3', 'a', 4, today),
    ];
    const q = srsQueue(cards, reviews, today, { newPerDay: 1, reviewsPerDay: 1 });
    expect(q.newDone).toBe(1);
    expect(q.reviewsDone).toBe(1);
    expect(q.fresh).toEqual([]);
    expect(q.due).toEqual([]);
  });
});

describe('readSrsLimits', () => {
  it('padrões e valores inválidos', () => {
    expect(readSrsLimits(undefined)).toEqual({ newPerDay: 20, reviewsPerDay: 200 });
    expect(readSrsLimits({ newPerDay: 5, reviewsPerDay: -1 })).toEqual({
      newPerDay: 5,
      reviewsPerDay: 200,
    });
  });
});
