import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { supabase } from '../supabase';
import { useSession } from '@/providers/session';
import { keys } from './keys';

const bossSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  max_hp: z.number(),
  hp: z.number(),
  status: z.enum(['active', 'defeated', 'escaped']),
  ends_at: z.string(),
  scope: z.enum(['user', 'folder', 'clan']).optional(),
});

const achievementSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  unlocked_at: z.string().nullable(),
});

const gameStateSchema = z.object({
  enabled: z.boolean(),
  xp: z.number(),
  level: z.number(),
  into_level: z.number(),
  for_next: z.number(),
  streak: z.number(),
  streak_best: z.number(),
  freeze_available: z.boolean(),
  active_today: z.boolean(),
  xp_today: z.number(),
  tasks_done: z.number(),
  boss: bossSchema.nullable(),
  clan: z
    .object({ id: z.string(), name: z.string(), icon: z.string().nullable(), members: z.number() })
    .nullable()
    .optional(),
  clan_boss: bossSchema.nullable().optional(),
  achievements: z.array(achievementSchema),
});

export type GameState = z.infer<typeof gameStateSchema>;
export type Boss = z.infer<typeof bossSchema>;
export { bossSchema };
export type Achievement = z.infer<typeof achievementSchema>;

/** Resumo que complete_task / uncomplete_task devolvem junto com a tarefa. */
export const completionSummarySchema = z.object({
  xp: z.number(),
  level: z.number().nullable(),
  level_up: z.boolean(),
  boss_defeated: z.boolean(),
  achievements: z.array(z.object({ key: z.string(), name: z.string(), icon: z.string() })),
});
export type CompletionSummary = z.infer<typeof completionSummarySchema>;

/** XP, nível, sequência, boss da semana e conquistas. Tudo calculado no banco (game_state). */
export function useGameState() {
  const { session } = useSession();
  return useQuery({
    queryKey: keys.game,
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('game_state');
      if (error) throw error;
      return gameStateSchema.parse(data);
    },
  });
}

/** Liga/desliga a gamificação (ESCOPO 4.6). O XP continua no ledger; só some da tela. */
export function useSetGamification() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('profiles')
        .update({ gamification_enabled: enabled })
        .eq('id', session?.user.id ?? '');
      if (error) throw error;
    },
    onMutate: (enabled) => {
      const previous = queryClient.getQueryData<GameState>(keys.game);
      if (previous) queryClient.setQueryData<GameState>(keys.game, { ...previous, enabled });
      return { previous };
    },
    onError: (_err, _enabled, context) => {
      if (context?.previous) queryClient.setQueryData(keys.game, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keys.game });
      queryClient.invalidateQueries({ queryKey: keys.profile });
    },
  });
}
