import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Card, CardReview } from '../srs';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, sessionUserId } from '../sync/local';

/**
 * Repetição espaçada (ET1, D386): os cartões que a pessoa vê (do texto das anotações, refeitos
 * pelo servidor) e as revisões dela. Depois da primeira sincronização lê e grava no aparelho; a fila
 * e o estado são conta do app (`lib/srs.ts`), o mesmo SM-2 do servidor.
 */
export type StudyCard = Card & { note_title: string };
export type CardsData = { cards: StudyCard[]; reviews: CardReview[] };

const KEY = ['cards'] as const;
const REVIEW_COLS = 'id, card_id, grade, day, reviewed_at';

export function useCards(noteId?: string | null) {
  return useQuery({
    queryKey: [...KEY, noteId ?? 'all'],
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<CardsData> => {
      const userId = await sessionUserId();
      if (!userId) return { cards: [], reviews: [] };
      if (isLocal()) {
        const [cards, reviews] = await Promise.all([
          db.getAll<StudyCard>(
            `select c.id, c.note_id, c.question, c.answer, c.position,
                    coalesce(n.title, '') as note_title
               from cards c left join notes n on n.id = c.note_id
              ${noteId ? 'where c.note_id = ?' : ''}
              order by n.title, c.note_id, c.position`,
            noteId ? [noteId] : [],
          ),
          db.getAll<CardReview>(
            `select ${REVIEW_COLS} from card_reviews where user_id = ? order by reviewed_at`,
            [userId],
          ),
        ]);
        return { cards, reviews };
      }
      let cardsQuery = supabase
        .from('cards')
        .select('id, note_id, question, answer, position, note:notes(title)')
        .order('note_id')
        .order('position');
      if (noteId) cardsQuery = cardsQuery.eq('note_id', noteId);
      const [c, r] = await Promise.all([
        cardsQuery,
        supabase
          .from('card_reviews')
          .select(REVIEW_COLS)
          .eq('user_id', userId)
          .order('reviewed_at'),
      ]);
      if (c.error) throw c.error;
      if (r.error) throw r.error;
      const cards = (c.data ?? []).map(({ note, ...card }) => ({
        ...card,
        note_title: (note as { title: string } | null)?.title ?? '',
      }));
      cards.sort((a, b) => a.note_title.localeCompare(b.note_title) || a.position - b.position);
      return { cards, reviews: (r.data ?? []) as CardReview[] };
    },
  });
}

/** Grava uma revisão (só inserção). Já entra na tela antes de gravar; uma de cada vez, em ordem. */
export function useReviewCard() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    scope: { id: 'card-review' },
    mutationFn: async (review: CardReview) => {
      if (isLocal()) {
        await db.execute(
          `insert into card_reviews (id, card_id, user_id, grade, day, reviewed_at, created_at)
           values (?, ?, ?, ?, ?, ?, ?)`,
          [
            review.id,
            review.card_id,
            await sessionUserId(),
            review.grade,
            review.day,
            review.reviewed_at,
            new Date().toISOString(),
          ],
        );
        return;
      }
      const { error } = await supabase.from('card_reviews').insert(review);
      if (error) throw error;
    },
    onMutate: async (review) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      queryClient.setQueriesData<CardsData>({ queryKey: KEY }, (d) =>
        d ? { ...d, reviews: [...d.reviews, review] } : d,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
