import { tr } from '@/lib/i18n-ref';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { z } from 'zod';

import type { Tables } from '../db';
import { supabase } from '../supabase';
import { useSession } from '@/providers/session';
import { keys } from './keys';

// Times: ficam no servidor (como o clã). O acesso aos projetos do time chega pelo folder_members,
// que o sync já traz.

export type TeamRole = 'owner' | 'admin' | 'member' | 'guest';
export const TEAM_ROLES = ['owner', 'admin', 'member', 'guest'] as const satisfies TeamRole[];
const RANK: Record<TeamRole, number> = { owner: 4, admin: 3, member: 2, guest: 1 };
export const teamRoleAtLeast = (role: TeamRole | undefined, min: TeamRole) =>
  !!role && RANK[role] >= RANK[min];

export const TEAM_ROLE_LABEL = {
  owner: 'team.roleOwner',
  admin: 'team.roleAdmin',
  member: 'team.roleMember',
  guest: 'team.roleGuest',
} as const satisfies Record<TeamRole, string>;

export const TEAM_ROLE_HINT = {
  owner: 'team.roleOwnerHint',
  admin: 'team.roleAdminHint',
  member: 'team.roleMemberHint',
  guest: 'team.roleGuestHint',
} as const satisfies Record<TeamRole, string>;

export type Team = Tables<'teams'> & { myRole: TeamRole; memberCount: number };
export type TeamMember = { userId: string; role: TeamRole; displayName: string; joinedAt: string };
export type TeamInvite = Tables<'team_invites'>;
export type JoinRequest = Tables<'team_join_requests'> & { displayName: string };
export type AuditEntry = Tables<'team_audit'> & { actor: string | null; target: string | null };

const AUDIT_TEXT = {
  invite_created: 'team.audit.invite_created',
  invite_revoked: 'team.audit.invite_revoked',
  member_joined: 'team.audit.member_joined',
  join_requested: 'team.audit.join_requested',
  join_approved: 'team.audit.join_approved',
  join_denied: 'team.audit.join_denied',
  member_removed: 'team.audit.member_removed',
  member_left: 'team.audit.member_left',
  role_changed: 'team.audit.role_changed',
  team_renamed: 'team.audit.team_renamed',
  project_added: 'team.audit.project_added',
  project_removed: 'team.audit.project_removed',
  project_deleted: 'team.audit.project_deleted',
  role_created: 'team.audit.role_created',
  role_updated: 'team.audit.role_updated',
  role_deleted: 'team.audit.role_deleted',
} as const;

/** Uma linha do histórico do time, já no idioma da pessoa. */
export function describeAudit(entry: AuditEntry, t: TFunction) {
  const key = AUDIT_TEXT[entry.action as keyof typeof AUDIT_TEXT];
  if (!key) return entry.action;
  const payload = (entry.payload ?? {}) as Record<string, string | undefined>;
  const roleKey = payload.to ?? payload.role;
  const role =
    roleKey && roleKey in TEAM_ROLE_LABEL
      ? t(TEAM_ROLE_LABEL[roleKey as TeamRole])
      : (roleKey ?? '');
  return t(key, {
    actor: entry.actor ?? t('team.someone'),
    target: entry.target ?? t('team.someone'),
    role,
    name: payload.to ?? payload.name ?? '',
  });
}

export function useTeams() {
  const { session } = useSession();
  return useQuery({
    queryKey: keys.teams,
    enabled: !!session,
    queryFn: async (): Promise<Team[]> => {
      const { data, error } = await supabase
        .from('teams')
        .select('*, team_members(user_id, role)')
        .order('created_at');
      if (error) throw error;
      return data.map(({ team_members, ...team }) => ({
        ...team,
        myRole: team_members.find((m) => m.user_id === session?.user.id)?.role ?? 'guest',
        memberCount: team_members.length,
      }));
    },
  });
}

export function useTeam(teamId: string) {
  const { session } = useSession();
  return useQuery({
    queryKey: keys.team(teamId),
    enabled: !!session && !!teamId,
    queryFn: async () => {
      const [team, members, projects] = await Promise.all([
        supabase.from('teams').select('*').eq('id', teamId).maybeSingle(),
        supabase
          .from('team_members')
          .select('user_id, role, joined_at, profile:profiles(display_name)')
          .eq('team_id', teamId)
          .order('joined_at'),
        supabase
          .from('folders')
          .select('id, name, icon, color, kind, archived')
          .eq('team_id', teamId)
          .order('position'),
      ]);
      if (team.error) throw team.error;
      if (members.error) throw members.error;
      if (projects.error) throw projects.error;
      if (!team.data) return null;
      const list: TeamMember[] = members.data.map((m) => ({
        userId: m.user_id,
        role: m.role,
        displayName: m.profile?.display_name || tr('common.someone'),
        joinedAt: m.joined_at,
      }));
      return {
        ...team.data,
        members: list,
        projects: projects.data,
        myRole: list.find((m) => m.userId === session?.user.id)?.role,
      };
    },
  });
}

/** Convites, pedidos e log: só Admin e Dono leem (a RLS devolve vazio para os outros). */
export function useTeamAdmin(teamId: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.teamAdmin(teamId),
    enabled: enabled && !!teamId,
    queryFn: async () => {
      const [invites, requests, audit] = await Promise.all([
        supabase
          .from('team_invites')
          .select('*')
          .eq('team_id', teamId)
          .is('revoked_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false }),
        supabase
          .from('team_join_requests')
          .select('*, profile:profiles!team_join_requests_user_id_fkey(display_name)')
          .eq('team_id', teamId)
          .eq('status', 'pending')
          .order('created_at'),
        supabase
          .from('team_audit')
          .select(
            '*, actor:profiles!team_audit_actor_id_fkey(display_name), target:profiles!team_audit_target_user_id_fkey(display_name)',
          )
          .eq('team_id', teamId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);
      if (invites.error) throw invites.error;
      if (requests.error) throw requests.error;
      if (audit.error) throw audit.error;
      return {
        invites: invites.data.filter((i) => i.uses < i.max_uses),
        requests: requests.data.map(({ profile, ...r }) => ({
          ...r,
          displayName: profile?.display_name || tr('common.someone'),
        })) as JoinRequest[],
        audit: audit.data.map(({ actor, target, ...a }) => ({
          ...a,
          actor: actor?.display_name ?? null,
          target: target?.display_name ?? null,
        })) as AuditEntry[],
      };
    },
  });
}

export type TeamCustomRole = Tables<'team_roles'>;

/** Cargos personalizados do time (todo mundo do time vê; Admin e Dono mudam). */
export function useTeamRoles(teamId: string | null | undefined) {
  return useQuery({
    queryKey: keys.teamRoles(teamId ?? ''),
    enabled: !!teamId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_roles')
        .select('*')
        .eq('team_id', teamId ?? '')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useTeamRoleMutations(teamId: string) {
  const queryClient = useQueryClient();
  const settle = () => {
    queryClient.invalidateQueries({ queryKey: keys.teamRoles(teamId) });
    queryClient.invalidateQueries({ queryKey: keys.teamAdmin(teamId) });
    queryClient.invalidateQueries({ queryKey: ['members'] });
  };
  return {
    save: useMutation({
      mutationFn: async (role: { id?: string; name: string; grants: string[] }) => {
        const { error } = role.id
          ? await supabase
              .from('team_roles')
              .update({ name: role.name, grants: role.grants })
              .eq('id', role.id)
          : await supabase
              .from('team_roles')
              .insert({ team_id: teamId, name: role.name, grants: role.grants });
        if (error) throw new Error(error.message);
      },
      onSettled: settle,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('team_roles').delete().eq('id', id);
        if (error) throw new Error(error.message);
      },
      onSettled: settle,
    }),
  };
}

/** Convites para o meu e-mail, ainda não usados. */
export function useMyTeamInvites() {
  const { session } = useSession();
  return useQuery({
    queryKey: keys.myTeamInvites,
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_invites')
        .select('id, token, role, team_id, expires_at, uses, max_uses, revoked_at, email')
        .not('email', 'is', null)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString());
      if (error) throw error;
      return data.filter((i) => i.uses < i.max_uses);
    },
  });
}

export function useTeamMutations(teamId?: string) {
  const queryClient = useQueryClient();
  const settle = () => {
    queryClient.invalidateQueries({ queryKey: keys.teams });
    if (teamId) {
      queryClient.invalidateQueries({ queryKey: keys.team(teamId) });
      queryClient.invalidateQueries({ queryKey: keys.teamAdmin(teamId) });
    }
  };
  // Mudou quem está no time: muda quem está nos projetos dele
  const settleAccess = () => {
    settle();
    queryClient.invalidateQueries({ queryKey: keys.tree });
    queryClient.invalidateQueries({ queryKey: ['members'] });
  };
  const rpcError = (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
  };

  return {
    create: useMutation({
      mutationFn: async ({ name, icon }: { name: string; icon?: string | null }) => {
        const { data, error } = await supabase
          .from('teams')
          .insert({ name, icon: icon || null })
          .select('id')
          .single();
        if (error) throw error;
        return data.id;
      },
      onSettled: settle,
    }),
    update: useMutation({
      mutationFn: async (patch: {
        name?: string;
        icon?: string | null;
        join_approval?: boolean;
      }) => {
        const { error } = await supabase
          .from('teams')
          .update(patch)
          .eq('id', teamId ?? '');
        rpcError(error);
      },
      onSettled: settle,
    }),
    remove: useMutation({
      mutationFn: async () => {
        const { error } = await supabase
          .from('teams')
          .delete()
          .eq('id', teamId ?? '');
        rpcError(error);
      },
      onSettled: settleAccess,
    }),
    setRole: useMutation({
      mutationFn: async ({ userId, role }: { userId: string; role: TeamRole }) => {
        const { error } = await supabase.rpc('set_team_member_role', {
          p_team_id: teamId ?? '',
          p_user_id: userId,
          p_role: role,
        });
        rpcError(error);
      },
      onSettled: settleAccess,
    }),
    removeMember: useMutation({
      mutationFn: async (userId: string) => {
        const { error } = await supabase.rpc('remove_team_member', {
          p_team_id: teamId ?? '',
          p_user_id: userId,
        });
        rpcError(error);
      },
      onSettled: settleAccess,
    }),
    invite: useMutation({
      mutationFn: async (input: {
        role: Exclude<TeamRole, 'owner'>;
        days: number;
        maxUses: number;
        email?: string;
      }) => {
        const { data, error } = await supabase.rpc('create_team_invite', {
          p_team_id: teamId ?? '',
          p_role: input.role,
          p_days: input.days,
          p_max_uses: input.maxUses,
          p_email: input.email || undefined,
        });
        if (error) throw error;
        return data;
      },
      onSettled: settle,
    }),
    revokeInvite: useMutation({
      mutationFn: async (inviteId: string) => {
        const { error } = await supabase.rpc('revoke_team_invite', { p_invite_id: inviteId });
        rpcError(error);
      },
      onSettled: settle,
    }),
    decide: useMutation({
      mutationFn: async ({ requestId, approve }: { requestId: string; approve: boolean }) => {
        const { error } = await supabase.rpc('decide_join_request', {
          p_request_id: requestId,
          p_approve: approve,
        });
        rpcError(error);
      },
      onSettled: settleAccess,
    }),
    createProject: useMutation({
      mutationFn: async (name: string) => {
        const { data, error } = await supabase
          .from('folders')
          .insert({ name, kind: 'project', team_id: teamId })
          .select('id')
          .single();
        if (error) throw error;
        return data.id;
      },
      onSettled: settleAccess,
    }),
    setProjectTeam: useMutation({
      mutationFn: async ({ folderId, team }: { folderId: string; team: string | null }) => {
        const { error } = await supabase.rpc('set_project_team', {
          p_folder_id: folderId,
          p_team_id: team as string,
        });
        rpcError(error);
      },
      onSettled: settleAccess,
    }),
  };
}

const previewSchema = z.discriminatedUnion('valid', [
  z.object({ valid: z.literal(false), reason: z.string() }),
  z.object({
    valid: z.literal(true),
    team_id: z.string(),
    team_name: z.string(),
    team_icon: z.string().nullable(),
    role: z.enum(TEAM_ROLES),
    inviter: z.string().nullable(),
    members: z.number(),
    needs_approval: z.boolean(),
    for_email: z.boolean(),
    email_matches: z.boolean(),
    already_member: z.boolean(),
    requested: z.boolean(),
  }),
]);
export type TeamInvitePreview = z.infer<typeof previewSchema>;

export function useTeamInvitePreview(token: string, signedIn: boolean) {
  return useQuery({
    queryKey: ['team-invite', token, signedIn],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('team_invite_preview', { p_token: token });
      if (error) throw error;
      return previewSchema.parse(data);
    },
  });
}

export function useAcceptTeamInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc('accept_team_invite', { p_token: token });
      if (error) throw error;
      return z
        .object({ team_id: z.string(), status: z.enum(['joined', 'requested', 'already']) })
        .parse(data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keys.teams });
      queryClient.invalidateQueries({ queryKey: keys.myTeamInvites });
      queryClient.invalidateQueries({ queryKey: keys.tree });
    },
  });
}
