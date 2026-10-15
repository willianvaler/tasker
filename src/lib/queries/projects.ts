import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { uuidv7 } from '@/lib/uuid';
import { z } from 'zod';

import type { Json, Tables } from '../db';
import type { MemberName } from '../members';
import { ROLE_PRESET, type Actor } from '../permissions';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, localInsert, TASK_WITH_PAGE_SQL, toTask, toTaskWithPage } from '../sync/local';
import { useSession } from '@/providers/session';
import { keys } from './keys';
import type { TaskWithPage } from './tasks';
import { useReceivedPages } from './shares';
import { useTree, type Folder, type Tree } from './tree';

export type Role = 'owner' | 'manager' | 'editor' | 'contributor' | 'viewer';
/** Cargos que se dão a alguém (Dono vem de criar o projeto ou do time). */
export const ASSIGNABLE_ROLES = ['manager', 'editor', 'contributor', 'viewer'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
export type Assignee = Tables<'task_assignees'>;
export type Member = {
  userId: string;
  role: Role;
  /** 'team': o cargo vem do cargo no time; 'direct': dado no próprio projeto. */
  source: 'direct' | 'team';
  /** Cargo personalizado do time, que vale no lugar do role */
  customRole: { id: string; name: string; grants: string[] } | null;
  aliases: string[];
  displayName: string;
};

const parseGrants = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    // Postgres manda text[] como {a,b} quando não vem por JSON
    return value
      .replace(/^\{|\}$/g, '')
      .split(',')
      .filter(Boolean);
  }
};

/** Pasta raiz (o projeto) de uma pasta. */
export function rootFolder(tree: Tree | undefined, folderId: string | null | undefined) {
  if (!tree || !folderId) return undefined;
  for (const root of tree.folders) {
    if (root.id === folderId || root.children.some((c) => c.id === folderId)) return root;
  }
  return undefined;
}

/** Página de projeto (pasta raiz compartilhada): aqui o @nome vira responsável. */
export function isProjectPage(tree: Tree | undefined, pageId: string | undefined) {
  const page = tree?.pages.find((p) => p.id === pageId);
  return !!rootFolder(tree, page?.folder_id)?.is_shared;
}

// ============================================================
// Membros e papéis
// ============================================================

export function useMembers(rootId: string | undefined) {
  return useQuery({
    queryKey: keys.members(rootId ?? ''),
    enabled: !!rootId,
    queryFn: async (): Promise<Member[]> => {
      if (isLocal()) {
        const rows = await db.getAll<{
          user_id: string;
          role: Role;
          source: string | null;
          aliases: string | null;
          display_name: string | null;
          custom_role_id: string | null;
          custom_role_name: string | null;
          custom_role_grants: string | null;
        }>(
          `select m.user_id, m.role, m.source, m.aliases, p.display_name, m.custom_role_id,
                  r.name as custom_role_name, r.grants as custom_role_grants
           from folder_members m
           left join people p on p.id = m.user_id
           left join team_roles r on r.id = m.custom_role_id
           where m.folder_id = ? order by m.joined_at`,
          [rootId],
        );
        return rows.map((m) => ({
          userId: m.user_id,
          role: m.role,
          source: m.source === 'team' ? 'team' : 'direct',
          customRole:
            m.custom_role_id && m.custom_role_name
              ? {
                  id: m.custom_role_id,
                  name: m.custom_role_name,
                  grants: parseGrants(m.custom_role_grants),
                }
              : null,
          aliases: m.aliases ? JSON.parse(m.aliases) : [],
          displayName: m.display_name || 'Alguém',
        }));
      }
      const { data, error } = await supabase
        .from('folder_members')
        .select(
          'user_id, role, source, aliases, joined_at, profile:profiles(display_name), custom_role:team_roles(id, name, grants)',
        )
        .eq('folder_id', rootId ?? '')
        .order('joined_at');
      if (error) throw error;
      return data.map((m) => ({
        userId: m.user_id,
        role: m.role,
        source: m.source === 'team' ? 'team' : 'direct',
        customRole: m.custom_role,
        aliases: m.aliases,
        displayName: m.profile?.display_name || 'Alguém',
      }));
    },
  });
}

/** Membros no formato do resolveMention. */
export function memberNames(members: Member[] | undefined): MemberName[] {
  return (members ?? []).map(({ userId, displayName, aliases }) => ({
    userId,
    displayName,
    aliases,
  }));
}

/**
 * Quem sou eu na pasta, para o can(): preset do cargo ou as permissões do cargo personalizado.
 * Pasta só minha: Dono. undefined enquanto carrega.
 */
export function useFolderActor(folderId: string | null | undefined): Actor | undefined {
  const { session } = useSession();
  const tree = useTree();
  const root = rootFolder(tree.data, folderId);
  const shared = !!root && (root.owner_id !== session?.user.id || !!root.team_id);
  const members = useMembers(shared ? root?.id : undefined);
  const received = useReceivedPages();
  const userId = session?.user.id;
  if (folderId && tree.data?.inbox?.folder_id === folderId) return { userId, preset: 'owner' };
  // Página recebida ao vivo: a pasta é do autor; aqui sou Executor (D133)
  if (!root && folderId && received.data?.some((p) => p.folder_id === folderId))
    return { userId, preset: 'executor' };
  if (!root) return undefined;
  if (!shared) return { userId, preset: 'owner' };
  const me = members.data?.find((m) => m.userId === userId);
  if (!me) return undefined;
  return me.customRole
    ? { userId, grants: me.customRole.grants }
    : { userId, preset: ROLE_PRESET[me.role] };
}

export function useMemberMutations(rootId: string) {
  const queryClient = useQueryClient();
  const onSettled = () => {
    queryClient.invalidateQueries({ queryKey: keys.members(rootId) });
    queryClient.invalidateQueries({ queryKey: keys.assignees });
  };
  const setRole = useMutation({
    mutationFn: async ({
      userId,
      role,
    }: {
      userId: string;
      role: AssignableRole | 'team' | { custom: string };
    }) => {
      if (typeof role === 'object') {
        const { error } = await supabase.rpc('set_member_custom_role', {
          p_folder_id: rootId,
          p_user_id: userId,
          p_role_id: role.custom,
        });
        if (error) throw error;
        return;
      }
      if (role === 'team') {
        const { error } = await supabase.rpc('reset_member_role', {
          p_folder_id: rootId,
          p_user_id: userId,
        });
        if (error) throw error;
        return;
      }
      const { error } = await supabase.rpc('set_member_role', {
        p_folder_id: rootId,
        p_user_id: userId,
        p_role: role,
      });
      if (error) throw error;
    },
    onSettled,
  });
  const remove = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('remove_member', {
        p_folder_id: rootId,
        p_user_id: userId,
      });
      if (error) throw error;
    },
    onSettled: () => {
      onSettled();
      queryClient.invalidateQueries({ queryKey: keys.tree });
    },
  });
  const claim = useMutation({
    mutationFn: async ({ name, userId }: { name: string; userId?: string }) => {
      const { data, error } = await supabase.rpc('claim_pending_assignee', {
        p_folder_id: rootId,
        p_pending_name: name,
        p_user_id: userId,
      });
      if (error) throw error;
      return data;
    },
    onSettled: () => {
      onSettled();
      queryClient.invalidateQueries({ queryKey: keys.tasks });
    },
  });
  return { setRole, remove, claim };
}

// ============================================================
// Convites
// ============================================================

export function useInviteMutations(folderId: string) {
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: async (role: AssignableRole) => {
      const { data, error } = await supabase.rpc('create_invite', {
        p_folder_id: folderId,
        p_role: role,
      });
      if (error) throw error;
      return data.token;
    },
    // A pasta vira projeto
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.tree }),
  });
  const revoke = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('revoke_invites', { p_folder_id: folderId });
      if (error) throw error;
    },
  });
  return { create, revoke };
}

const previewSchema = z.discriminatedUnion('valid', [
  z.object({ valid: z.literal(false), reason: z.string() }),
  z.object({
    valid: z.literal(true),
    folder_id: z.string(),
    folder_name: z.string(),
    folder_icon: z.string().nullable(),
    role: z.enum(['owner', 'manager', 'editor', 'contributor', 'viewer']),
    inviter: z.string().nullable(),
    members: z.number(),
    already_member: z.boolean(),
  }),
]);
export type InvitePreview = z.infer<typeof previewSchema>;

export function useInvitePreview(token: string, signedIn: boolean) {
  return useQuery({
    queryKey: ['invite', token, signedIn],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('invite_preview', { p_token: token });
      if (error) throw error;
      return previewSchema.parse(data);
    },
  });
}

const acceptSchema = z.object({
  folder_id: z.string(),
  joined: z.boolean(),
  pending: z.array(z.string()),
});

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc('accept_invite', { p_token: token });
      if (error) throw error;
      return acceptSchema.parse(data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keys.tree });
      queryClient.invalidateQueries({ queryKey: keys.tasks });
    },
  });
}

/** Link do convite. Na web, o endereço atual; no app, EXPO_PUBLIC_WEB_URL (cai na web sem o app). */
export function inviteUrl(token: string, route: 'invite' | 'team-invite' = 'invite') {
  const base =
    process.env.EXPO_PUBLIC_WEB_URL ||
    (typeof window !== 'undefined' && window.location?.origin) ||
    'http://localhost:8082';
  return `${base.replace(/\/$/, '')}/${route}/${token}`;
}

// ============================================================
// Responsáveis
// ============================================================

/** Todos os responsáveis visíveis (só existem em projetos). Por tarefa: assigneesOf. */
export function useAssignees() {
  const { session } = useSession();
  return useQuery({
    queryKey: keys.assignees,
    enabled: !!session,
    queryFn: async () => {
      if (isLocal())
        return (await db.getAll<Assignee>('select * from task_assignees order by created_at')).map(
          (a) => ({ ...a, created_at: a.created_at.replace(' ', 'T') }),
        );
      const { data, error } = await supabase.from('task_assignees').select('*').order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

export function assigneesOf(all: Assignee[] | undefined, taskId: string) {
  return (all ?? []).filter((a) => a.task_id === taskId);
}

/** Nomes pendentes do projeto (pasta raiz e subpastas), sem repetir. */
export function pendingNamesOf(all: Assignee[] | undefined, folderIds: string[]) {
  const names = new Map<string, string>();
  for (const a of all ?? []) {
    if (a.pending_name && folderIds.includes(a.folder_id)) {
      const key = a.pending_name.toLowerCase();
      if (!names.has(key)) names.set(key, a.pending_name);
    }
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

export function useAssigneeMutations() {
  const queryClient = useQueryClient();
  const settle = () => {
    queryClient.invalidateQueries({ queryKey: keys.assignees });
    queryClient.invalidateQueries({ queryKey: keys.mine });
  };
  const add = useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async (input: { taskId: string; userId?: string; pendingName?: string }) => {
      if (isLocal()) {
        const task = await db.getOptional<{ folder_id: string }>(
          'select folder_id from tasks where id = ?',
          [input.taskId],
        );
        await localInsert('task_assignees', {
          id: uuidv7(),
          task_id: input.taskId,
          folder_id: task?.folder_id ?? null,
          user_id: input.userId ?? null,
          pending_name: input.userId ? null : (input.pendingName ?? null),
          created_at: new Date().toISOString(),
        });
        return;
      }
      const { error } = await supabase.from('task_assignees').insert({
        id: uuidv7(),
        task_id: input.taskId,
        user_id: input.userId ?? null,
        pending_name: input.userId ? null : (input.pendingName ?? null),
      });
      if (error) throw error;
    },
    onSettled: settle,
  });
  const remove = useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async (id: string) => {
      if (isLocal()) {
        await db.execute('delete from task_assignees where id = ?', [id]);
        return;
      }
      const { error } = await supabase.from('task_assignees').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: keys.assignees });
      const previous = queryClient.getQueryData<Assignee[]>(keys.assignees);
      queryClient.setQueryData<Assignee[]>(keys.assignees, (list) =>
        list?.filter((a) => a.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => queryClient.setQueryData(keys.assignees, context?.previous),
    onSettled: settle,
  });
  return { add, remove };
}

/** Minhas tarefas: abertas e atribuídas a mim, de todos os projetos. */
/** `enabled: false` evita a busca para quem não participa de projeto. */
export function useMyTasks({ enabled = true }: { enabled?: boolean } = {}) {
  const { session } = useSession();
  return useQuery({
    queryKey: keys.mine,
    enabled: !!session && enabled,
    queryFn: async () => {
      if (isLocal()) {
        const rows = await db.getAll<Record<string, unknown>>(
          `${TASK_WITH_PAGE_SQL} where t.status != 'done' and exists (
             select 1 from task_assignees a where a.task_id = t.id and a.user_id = ?)
           order by t.due_date is null, t.due_date, t.priority desc, t.position`,
          [session?.user.id],
        );
        return rows.map(toTaskWithPage) as TaskWithPage[];
      }
      const { data, error } = await supabase
        .from('tasks')
        .select('*, page:pages(name, icon, view_type), task_assignees!inner(user_id)')
        .eq('task_assignees.user_id', session?.user.id ?? '')
        .neq('status', 'done')
        .order('due_date', { nullsFirst: false })
        .order('priority', { ascending: false })
        .order('position');
      if (error) throw error;
      return data.map(({ task_assignees: _assignees, ...task }) => task) as TaskWithPage[];
    },
  });
}

// ============================================================
// Comentários, atividade e notificações
// ============================================================

export type Comment = Tables<'comments'> & { author: { display_name: string } | null };

export function useComments(taskId: string | undefined) {
  return useQuery({
    queryKey: keys.comments(taskId ?? ''),
    enabled: !!taskId,
    queryFn: async () => {
      if (isLocal()) {
        const rows = await db.getAll<Tables<'comments'> & { author_name: string | null }>(
          `select c.*, p.display_name as author_name from comments c
           left join people p on p.id = c.author_id where c.task_id = ? order by c.created_at`,
          [taskId],
        );
        return rows.map(({ author_name, ...c }) => ({
          ...c,
          created_at: c.created_at.replace(' ', 'T'),
          author: author_name == null ? null : { display_name: author_name },
        })) as Comment[];
      }
      const { data, error } = await supabase
        .from('comments')
        .select('*, author:profiles(display_name)')
        .eq('task_id', taskId ?? '')
        .order('created_at');
      if (error) throw error;
      return data as Comment[];
    },
  });
}

export function useCommentMutations(taskId: string) {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const key = keys.comments(taskId);
  const add = useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      if (isLocal()) {
        const task = await db.getOptional<{ folder_id: string }>(
          'select folder_id from tasks where id = ?',
          [taskId],
        );
        await localInsert('comments', {
          id,
          task_id: taskId,
          folder_id: task?.folder_id ?? null,
          author_id: session?.user.id ?? null,
          body,
          created_at: new Date().toISOString(),
        });
        return;
      }
      const { error } = await supabase.from('comments').insert({ id, task_id: taskId, body });
      if (error) throw error;
    },
    onMutate: async ({ id, body }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Comment[]>(key);
      const optimistic: Comment = {
        id,
        task_id: taskId,
        folder_id: '',
        author_id: session?.user.id ?? '',
        body,
        created_at: new Date().toISOString(),
        author: null,
      };
      queryClient.setQueryData<Comment[]>(key, (list) => [...(list ?? []), optimistic]);
      return { previous };
    },
    onError: (_err, _vars, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const remove = useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async (id: string) => {
      if (isLocal()) {
        await db.execute('delete from comments where id = ?', [id]);
        return;
      }
      const { error } = await supabase.from('comments').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  return { add, remove };
}

export type Activity = Tables<'activity_log'> & { actor: { display_name: string } | null };

export function useActivity(rootId: string | undefined) {
  return useQuery({
    queryKey: keys.activity(rootId ?? ''),
    enabled: !!rootId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*, actor:profiles(display_name)')
        .eq('folder_id', rootId ?? '')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as Activity[];
    },
  });
}

export type Notification = Tables<'notifications'>;

export function useNotifications() {
  const { session } = useSession();
  return useQuery({
    queryKey: keys.notifications,
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null);
      if (error) throw error;
    },
    onMutate: () => {
      const now = new Date().toISOString();
      queryClient.setQueryData<Notification[]>(keys.notifications, (list) =>
        list?.map((n) => (n.read_at ? n : { ...n, read_at: now })),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.notifications }),
  });
}

// ============================================================
// Modelos
// ============================================================

export type TemplateData = {
  pages: {
    name: string;
    icon?: string | null;
    view_type?: string;
    reset_cycle?: string;
    items: unknown[];
  }[];
};

export function useUserTemplates() {
  const { session } = useSession();
  return useQuery({
    queryKey: keys.templates,
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useTemplateMutations() {
  const queryClient = useQueryClient();
  const createFrom = useMutation({
    mutationFn: async (input: {
      name: string;
      icon: string;
      data: TemplateData;
      shared: boolean;
    }) => {
      const { data, error } = await supabase.rpc('create_from_template', {
        p_name: input.name,
        p_icon: input.icon,
        p_data: input.data as unknown as Json,
        p_shared: input.shared,
      });
      if (error) throw error;
      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keys.tree });
      queryClient.invalidateQueries({ queryKey: keys.tasks });
    },
  });
  const saveFolder = useMutation({
    mutationFn: async ({ folder, name }: { folder: Folder; name: string }) => {
      const { error } = await supabase.rpc('save_folder_as_template', {
        p_folder_id: folder.id,
        p_name: name,
      });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.templates }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.templates }),
  });
  return { createFrom, saveFolder, remove };
}

/** Tarefas principais do projeto (pasta raiz e subpastas), para o progresso. */
export function useFolderTasks(root: { id: string; children: { id: string }[] } | undefined) {
  const ids = root ? [root.id, ...root.children.map((c) => c.id)] : [];
  return useQuery({
    queryKey: keys.folderTasks(root?.id ?? ''),
    enabled: !!root,
    queryFn: async () => {
      if (isLocal())
        return (
          await db.getAll<Record<string, unknown>>(
            `select * from tasks where parent_task_id is null
             and folder_id in (select value from json_each(?))`,
            [JSON.stringify(ids)],
          )
        ).map(toTask);
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .in('folder_id', ids)
        .is('parent_task_id', null);
      if (error) throw error;
      return data;
    },
  });
}
