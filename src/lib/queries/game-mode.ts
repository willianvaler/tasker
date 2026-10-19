import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { supabase } from '../supabase';
import { useSession } from '@/providers/session';
import { completionSummarySchema, useGameLevel } from './game';
import { keys } from './keys';

// Modo jogo Completo (ESCOPO_V8, HB5 a HB10). Tudo é regra do servidor (RPCs em
// 20261156000000_modo_jogo.sql) e só funciona online: as tabelas novas não entram no sync.

const stableKey = ['game-stable'] as const;
const rewardsKey = ['game-rewards'] as const;
const dayStartKey = ['game-day-start'] as const;

/** Depois de qualquer ação do jogo: o estado (vida, mana, ouro), o estábulo e o perfil mudam. */
function useRefreshGame() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: keys.game });
    queryClient.invalidateQueries({ queryKey: stableKey });
    queryClient.invalidateQueries({ queryKey: keys.profile });
  };
}

async function rpc<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw error;
  return data as T;
}

// ---------- HB5: virada do dia, morte, poção, taverna

const dayStartPreviewSchema = z.object({
  pending: z.boolean(),
  resting: z.boolean().nullable().optional(),
  items: z.array(z.object({ id: z.string(), title: z.string(), priority: z.number() })).default([]),
});
export type DayStartPreview = z.infer<typeof dayStartPreviewSchema>;

/** "O que você fez ontem?": as diárias que a virada vai cobrar (vazio se não há o que fazer). */
export function useDayStartPreview() {
  const { session } = useSession();
  const full = useGameLevel() === 'full';
  return useQuery({
    queryKey: dayStartKey,
    enabled: !!session && full,
    // Não guarda no disco nem reaproveita: a pergunta é do dia
    gcTime: 0,
    staleTime: 0,
    queryFn: async () => dayStartPreviewSchema.parse(await rpc('day_start_preview')),
  });
}

const dayStartResultSchema = z.object({
  applied: z.boolean(),
  damage: z.number().optional(),
  missed: z.number().optional(),
  hp: z.number().optional(),
  dead: z.boolean().optional(),
  mp_gain: z.number().optional(),
  perfect: z.boolean().optional(),
  buff: z.number().optional(),
  resting: z.boolean().optional(),
});
export type DayStartResult = z.infer<typeof dayStartResultSchema>;

export function useDayStart() {
  const queryClient = useQueryClient();
  const refresh = useRefreshGame();
  return useMutation({
    mutationFn: async (did: string[]) =>
      dayStartResultSchema.parse(await rpc('day_start', { p_did: did })),
    onSettled: () => {
      queryClient.setQueryData(dayStartKey, { pending: false, items: [] });
      refresh();
    },
  });
}

export function useRevive() {
  const refresh = useRefreshGame();
  return useMutation({
    mutationFn: (buy: boolean) => rpc('revive', { p_buy: buy }),
    onSettled: refresh,
  });
}

export function useBuyPotion() {
  const refresh = useRefreshGame();
  return useMutation({ mutationFn: () => rpc('buy_potion'), onSettled: refresh });
}

/** Taverna (descansar) e vocabulário de jogo: preferências do perfil que a pessoa grava. */
export function useSetGamePref() {
  const { session } = useSession();
  const refresh = useRefreshGame();
  return useMutation({
    mutationFn: async (patch: {
      resting?: boolean;
      game_vocab?: boolean;
      use_costume?: boolean;
    }) => {
      const { error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', session?.user.id ?? '');
      if (error) throw error;
    },
    onSettled: refresh,
  });
}

// ---------- HB6: habilidades de mana

export function useCastManaSkill() {
  const refresh = useRefreshGame();
  return useMutation({
    mutationFn: async (key: string) => {
      const data = await rpc<Record<string, unknown>>('cast_mana_skill', { p_key: key });
      return {
        damage: Number(data.damage ?? 0),
        gold: Number(data.gold ?? 0),
        summary: completionSummarySchema.safeParse(data).data ?? null,
      };
    },
    onSettled: refresh,
  });
}

// ---------- HB7: recompensas e baú

const rewardSchema = z.object({
  id: z.string(),
  title: z.string(),
  cost: z.number(),
  icon: z.string().nullable(),
  position: z.number(),
});
export type Reward = z.infer<typeof rewardSchema>;

export function useRewards() {
  const { session } = useSession();
  return useQuery({
    queryKey: rewardsKey,
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_rewards')
        .select('id, title, cost, icon, position')
        .order('position')
        .order('created_at');
      if (error) throw error;
      return z.array(rewardSchema).parse(data);
    },
  });
}

export function useRewardActions() {
  const queryClient = useQueryClient();
  const refresh = useRefreshGame();
  const settle = () => queryClient.invalidateQueries({ queryKey: rewardsKey });
  return {
    save: useMutation({
      mutationFn: async (r: { id?: string; title: string; cost: number; icon?: string | null }) => {
        const row = { title: r.title.trim(), cost: r.cost, icon: r.icon ?? null };
        const { error } = r.id
          ? await supabase.from('user_rewards').update(row).eq('id', r.id)
          : await supabase.from('user_rewards').insert(row);
        if (error) throw error;
      },
      onSettled: settle,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('user_rewards').delete().eq('id', id);
        if (error) throw error;
      },
      onSettled: settle,
    }),
    redeem: useMutation({
      mutationFn: (id: string) => rpc('redeem_reward', { p_id: id }),
      onSettled: refresh,
    }),
    armoire: useMutation({
      mutationFn: async () =>
        z
          .object({
            gold: z.number(),
            item: z
              .object({ key: z.string(), name: z.string(), icon: z.string(), rarity: z.string() })
              .optional(),
            food: z.string().optional(),
          })
          .parse(await rpc('open_armoire')),
      onSettled: refresh,
    }),
  };
}

// ---------- HB8: estábulo; HB9: pergaminhos e missões

const stableSchema = z.object({
  stacks: z.array(z.object({ kind: z.string(), key: z.string(), qty: z.number() })),
  pets: z.array(z.object({ species: z.string(), potion: z.string(), fed: z.number() })),
  mounts: z.array(z.object({ species: z.string(), potion: z.string() })),
});
export type Stable = z.infer<typeof stableSchema>;

export function useStable() {
  const { session } = useSession();
  return useQuery({
    queryKey: stableKey,
    enabled: !!session,
    queryFn: async () => {
      const [stacks, pets, mounts] = await Promise.all([
        supabase.from('user_stacks').select('kind, key, qty').order('kind').order('key'),
        supabase.from('user_pets').select('species, potion, fed').order('hatched_at'),
        supabase.from('user_mounts').select('species, potion').order('tamed_at'),
      ]);
      for (const r of [stacks, pets, mounts]) if (r.error) throw r.error;
      return stableSchema.parse({ stacks: stacks.data, pets: pets.data, mounts: mounts.data });
    },
  });
}

export function useStableActions() {
  const refresh = useRefreshGame();
  return {
    hatch: useMutation({
      mutationFn: (v: { species: string; potion: string }) =>
        rpc('hatch_pet', { p_species: v.species, p_potion: v.potion }),
      onSettled: refresh,
    }),
    feed: useMutation({
      mutationFn: async (v: { species: string; potion: string; food: string }) =>
        z
          .object({ mount: z.boolean(), fed: z.number(), favorite: z.boolean() })
          .parse(
            await rpc('feed_pet', { p_species: v.species, p_potion: v.potion, p_food: v.food }),
          ),
      onSettled: refresh,
    }),
    companion: useMutation({
      mutationFn: (v: { kind: 'pet' | 'mount'; value: string | null }) =>
        rpc('set_companion', { p_kind: v.kind, p_value: v.value }),
      onSettled: refresh,
    }),
    buyScroll: useMutation({
      mutationFn: (quest: string) => rpc('buy_scroll', { p_quest: quest }),
      onSettled: refresh,
    }),
    startQuest: useMutation({
      mutationFn: (v: { quest: string; clan: boolean }) =>
        rpc('start_quest', { p_quest: v.quest, p_clan: v.clan }),
      onSettled: refresh,
    }),
  };
}

// ---------- HB10: aparência e fantasia

export function useAppearanceActions() {
  const refresh = useRefreshGame();
  return {
    appearance: useMutation({
      mutationFn: (v: { portrait: string | null; background: string | null }) =>
        rpc('set_appearance', { p_portrait: v.portrait, p_background: v.background }),
      onSettled: refresh,
    }),
    costume: useMutation({
      mutationFn: (v: { slot: string; item: string | null }) =>
        rpc('equip_costume', { p_slot: v.slot, p_item: v.item }),
      onSettled: refresh,
    }),
  };
}
