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
  scope: z.enum(['user', 'daily', 'folder', 'clan']).optional(),
  level: z.number().optional(),
});

const achievementSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  unlocked_at: z.string().nullable(),
});

const attrsSchema = z.object({
  str: z.number(),
  agi: z.number(),
  int: z.number(),
  con: z.number(),
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
  damage_today: z.number().default(0),
  bosses_defeated: z.number().default(0),
  best_hit: z.number().default(0),
  gold: z.number().default(0),
  class: z.string().nullable().default(null),
  attributes: attrsSchema.default({ str: 1, agi: 1, int: 1, con: 1 }),
  allocated: attrsSchema.default({ str: 0, agi: 0, int: 0, con: 0 }),
  points: z.number().nullable().default(0),
  skill_active: z
    .boolean()
    .nullable()
    .transform((v) => !!v),
  first_strike_ready: z
    .boolean()
    .nullable()
    .transform((v) => !!v),
  equipped: z.record(z.string(), z.string()).default({}),
  inventory: z.array(z.string()).default([]),
  boss: bossSchema.nullable(),
  /** Boss diário (O1); null/ausente em respostas antigas */
  daily_boss: bossSchema.nullable().optional(),
  daily_defeated: z.number().default(0),
  daily_streak: z.number().default(0),
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
  damage: z.number().optional(),
  crit: z.boolean().optional(),
  heal: z.number().optional(),
  gold: z.number().optional(),
  drops: z.array(z.object({ key: z.string(), name: z.string(), icon: z.string() })).optional(),
  /** Estimativa local enquanto a ação está na fila do sync (o servidor ainda não respondeu) */
  pending: z.boolean().optional(),
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

/** Liga/desliga a gamificação. O XP continua no ledger; só some da tela. */
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

// ============================================================
// Personagem, loja e itens. Tudo passa por funções do servidor.
// ============================================================

const itemSchema = z.object({
  key: z.string(),
  name: z.string(),
  icon: z.string(),
  slot: z.enum(['head', 'hand', 'pet', 'aura', 'title']),
  rarity: z.enum(['common', 'rare', 'epic', 'legendary']),
  price: z.number().nullable(),
  drop: z.boolean(),
  position: z.number(),
});
export type Item = z.infer<typeof itemSchema>;

/** Catálogo da loja (público, muda pouco). */
export function useItems() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['items'],
    enabled: !!session,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('items').select('*').order('position');
      if (error) throw error;
      return z.array(itemSchema).parse(data);
    },
  });
}

const newAchievements = z
  .object({ achievements: z.array(z.object({ name: z.string(), icon: z.string() })).optional() })
  .passthrough();

/** Chama uma função do personagem e recarrega o estado do jogo. Devolve as conquistas novas. */
function useGameRpc<V>(call: (vars: V) => PromiseLike<{ data: unknown; error: unknown }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: V) => {
      const { data, error } = await call(vars);
      if (error) throw error;
      return newAchievements.safeParse(data).data?.achievements ?? [];
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keys.game });
      queryClient.invalidateQueries({ queryKey: keys.profile });
    },
  });
}

export const useSetClass = () =>
  useGameRpc((cls: string) => supabase.rpc('set_class', { p_class: cls }));
export const useAllocateAttribute = () =>
  useGameRpc((attr: string) => supabase.rpc('allocate_attribute', { p_attr: attr }));
export const useResetAttributes = () => useGameRpc(() => supabase.rpc('reset_attributes'));
export const useUseSkill = () => useGameRpc(() => supabase.rpc('use_skill'));
export const useBuyItem = () =>
  useGameRpc((item: string) => supabase.rpc('buy_item', { p_item: item }));

/** Equipar é otimista: a ficha muda na hora. */
export function useEquipItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ slot, item }: { slot: string; item: string | null }) => {
      const { error } = await supabase.rpc('equip_item', { p_slot: slot, p_item: item as string });
      if (error) throw error;
    },
    onMutate: ({ slot, item }) => {
      const previous = queryClient.getQueryData<GameState>(keys.game);
      if (previous) {
        const equipped = { ...previous.equipped };
        if (item) equipped[slot] = item;
        else delete equipped[slot];
        queryClient.setQueryData<GameState>(keys.game, { ...previous, equipped });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(keys.game, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.game }),
  });
}
