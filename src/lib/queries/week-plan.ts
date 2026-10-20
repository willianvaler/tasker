import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { WorkoutMove } from '../gym/week-plan';
import type { IsoDate } from '../parser/dates';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, sessionUserId } from '../sync/local';
import { uuidv7 } from '../uuid';

// Remarcações de treino (AC9.5, D243): de cada pessoa, sem mexer no plano da página.

const KEY = ['workout-moves'] as const;
type Row = WorkoutMove & { id: string };

export function useWorkoutMoves() {
  return useQuery({
    queryKey: KEY,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<Row[]> => {
      const userId = await sessionUserId();
      if (!userId) return [];
      if (isLocal())
        return db.getAll<Row>(
          'select id, page_id, from_day, to_day from workout_moves where user_id = ?',
          [userId],
        );
      const { data, error } = await supabase
        .from('workout_moves')
        .select('id, page_id, from_day, to_day')
        .eq('user_id', userId);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
}

/**
 * Remarca o treino de `from` para `to` (null: pular); `undo` desfaz a remarcação daquele dia.
 * Um registro por treino e dia de origem.
 */
export function useMoveWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async ({
      pageId,
      from,
      to,
      undo,
    }: {
      pageId: string;
      from: IsoDate;
      to?: IsoDate | null;
      undo?: boolean;
    }) => {
      const existing = queryClient
        .getQueryData<Row[]>(KEY)
        ?.find((m) => m.page_id === pageId && m.from_day === from);
      if (isLocal()) {
        const userId = await sessionUserId();
        if (undo) {
          if (existing) await db.execute('delete from workout_moves where id = ?', [existing.id]);
        } else if (existing)
          await db.execute('update workout_moves set to_day = ? where id = ?', [
            to ?? null,
            existing.id,
          ]);
        else
          await db.execute(
            `insert into workout_moves (id, page_id, user_id, from_day, to_day, created_at)
             values (?, ?, ?, ?, ?, ?)`,
            [uuidv7(), pageId, userId, from, to ?? null, new Date().toISOString()],
          );
        return;
      }
      if (undo) {
        if (!existing) return;
        const { error } = await supabase.from('workout_moves').delete().eq('id', existing.id);
        if (error) throw error;
        return;
      }
      const { error } = existing
        ? await supabase
            .from('workout_moves')
            .update({ to_day: to ?? null })
            .eq('id', existing.id)
        : await supabase
            .from('workout_moves')
            .insert({ id: uuidv7(), page_id: pageId, from_day: from, to_day: to ?? null });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
