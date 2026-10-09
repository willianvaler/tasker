import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import type { Tables } from '../db';
import { supabase } from '../supabase';
import { useSession } from '@/providers/session';
import { bossSchema } from './game';
import { keys } from './keys';

// ============================================================
// Clã (ESCOPO 4.6): grupo de amigos com boss semanal e feed, sem chat
// ============================================================

export type ClanActivity = Tables<'clan_activity'> & { actor: { display_name: string } | null };

export function useClan() {
  const { session } = useSession();
  return useQuery({
    queryKey: keys.clan,
    enabled: !!session,
    queryFn: async () => {
      const { data: clan, error } = await supabase.from('clans').select('*').maybeSingle();
      if (error) throw error;
      if (!clan) return null;
      const [members, activity] = await Promise.all([
        supabase
          .from('clan_members')
          .select('user_id, role, joined_at, profile:profiles(display_name, level)')
          .eq('clan_id', clan.id)
          .order('joined_at'),
        supabase
          .from('clan_activity')
          .select('*, actor:profiles(display_name)')
          .eq('clan_id', clan.id)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);
      if (members.error) throw members.error;
      if (activity.error) throw activity.error;
      return {
        ...clan,
        members: members.data.map((m) => ({
          userId: m.user_id,
          role: m.role,
          displayName: m.profile?.display_name || 'Alguém',
          level: m.profile?.level ?? 1,
        })),
        activity: activity.data as ClanActivity[],
      };
    },
  });
}

export function useClanMutations() {
  const queryClient = useQueryClient();
  const settle = () => {
    queryClient.invalidateQueries({ queryKey: keys.clan });
    queryClient.invalidateQueries({ queryKey: keys.game });
  };
  const create = useMutation({
    mutationFn: async ({ name, icon }: { name: string; icon: string }) => {
      const { data, error } = await supabase.rpc('create_clan', { p_name: name, p_icon: icon });
      if (error) throw error;
      return data;
    },
    onSettled: settle,
  });
  const invite = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('create_clan_invite');
      if (error) throw error;
      return data;
    },
  });
  const join = useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc('join_clan', { p_token: token });
      if (error) throw error;
      return data;
    },
    onSettled: settle,
  });
  const leave = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('leave_clan');
      if (error) throw error;
    },
    onSettled: settle,
  });
  return { create, invite, join, leave };
}

const clanPreviewSchema = z.discriminatedUnion('valid', [
  z.object({ valid: z.literal(false), reason: z.string() }),
  z.object({
    valid: z.literal(true),
    clan_id: z.string(),
    name: z.string(),
    icon: z.string().nullable(),
    members: z.number(),
    inviter: z.string().nullable(),
    my_clan: z.string().nullable(),
  }),
]);

export function useClanInvitePreview(token: string, signedIn: boolean) {
  return useQuery({
    queryKey: ['clan-invite', token, signedIn],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('clan_invite_preview', { p_token: token });
      if (error) throw error;
      return clanPreviewSchema.parse(data);
    },
  });
}

/** Link do convite do clã (mesma regra do convite de projeto). */
export function clanInviteUrl(token: string) {
  const base =
    process.env.EXPO_PUBLIC_WEB_URL ||
    (typeof window !== 'undefined' && window.location?.origin) ||
    'http://localhost:8081';
  return `${base.replace(/\/$/, '')}/clan-invite/${token}`;
}

// ============================================================
// Boss de projeto e quadro de contribuição
// ============================================================

export function useProjectBoss(rootId: string | undefined) {
  return useQuery({
    queryKey: keys.projectBoss(rootId ?? ''),
    enabled: !!rootId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bosses')
        .select('id, name, icon, max_hp, hp, status, ends_at, scope')
        .eq('scope', 'folder')
        .eq('scope_id', rootId ?? '')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? bossSchema.parse(data) : null;
    },
  });
}

export function useProjectBossMutations(rootId: string) {
  const queryClient = useQueryClient();
  const settle = () => {
    queryClient.invalidateQueries({ queryKey: keys.projectBoss(rootId) });
    queryClient.invalidateQueries({ queryKey: keys.activity(rootId) });
  };
  const start = useMutation({
    mutationFn: async (deadline: string) => {
      const { error } = await supabase.rpc('start_project_boss', {
        p_folder_id: rootId,
        p_deadline: deadline,
      });
      if (error) throw error;
    },
    onSettled: settle,
  });
  const cancel = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('cancel_project_boss', { p_folder_id: rootId });
      if (error) throw error;
    },
    onSettled: settle,
  });
  return { start, cancel };
}

const boardSchema = z.array(
  z.object({ user_id: z.string(), name: z.string(), damage: z.number() }),
);
export type BoardEntry = z.infer<typeof boardSchema>[number];

export function useBossBoard(bossId: string | undefined) {
  return useQuery({
    queryKey: keys.board(bossId ?? ''),
    enabled: !!bossId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('boss_board', { p_boss_id: bossId ?? '' });
      if (error) throw error;
      return boardSchema.parse(data);
    },
  });
}

// ============================================================
// Privacidade: exportar e excluir conta (ESCOPO 9)
// ============================================================

export async function exportMyData() {
  const { data, error } = await supabase.rpc('export_my_data');
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function deleteMyAccount() {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
}
