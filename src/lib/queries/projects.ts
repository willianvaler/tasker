import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { z } from 'zod';

import type { Json, Tables } from '../db';
import type { MemberName } from '../members';
import { supabase } from '../supabase';
import { useSession } from '@/providers/session';
import { keys } from './keys';
import type { TaskWithPage } from './tasks';
import { useTree, type Folder, type Tree } from './tree';

export type Role = 'owner' | 'editor' | 'viewer';
export type Assignee = Tables<'task_assignees'>;
export type Member = {
  userId: string;
  role: Role;
  aliases: string[];
  displayName: string;
};

/** Pasta raiz (o projeto) de uma pasta. */
export function rootFolder(tree: Tree | undefined, folderId: string | null | undefined) {
  if (!tree || !folderId) return undefined;
  for (const root of tree.folders) {
    if (root.id === folderId || root.children.some((c) => c.id === folderId)) return root;
  }
  return undefined;
}

/** Página de projeto (pasta raiz compartilhada): aqui o @nome vira responsável (ESCOPO 4.1). */
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
      const { data, error } = await supabase
        .from('folder_members')
        .select('user_id, role, aliases, joined_at, profile:profiles(display_name)')
        .eq('folder_id', rootId ?? '')
        .order('joined_at');
      if (error) throw error;
      return data.map((m) => ({
        userId: m.user_id,
        role: m.role,
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
 * Papel do usuário na pasta (pela raiz). Pasta só sua: dono, sem consulta. undefined enquanto
 * carrega (quem usa decide; useCanWrite deixa escrever e o servidor confere).
 */
export function useFolderRole(folderId: string | null | undefined): Role | undefined {
  const { session } = useSession();
  const tree = useTree();
  const root = rootFolder(tree.data, folderId);
  const shared = !!root && root.owner_id !== session?.user.id;
  const members = useMembers(shared ? root?.id : undefined);
  // Caixa de entrada (fora da árvore) e pastas próprias: dono
  if (folderId && tree.data?.inbox?.folder_id === folderId) return 'owner';
  if (!root) return undefined;
  if (!shared) return 'owner';
  return members.data?.find((m) => m.userId === session?.user.id)?.role;
}

export const canEdit = (role: Role | undefined) => role === 'owner' || role === 'editor';

export function useMemberMutations(rootId: string) {
  const queryClient = useQueryClient();
  const onSettled = () => {
    queryClient.invalidateQueries({ queryKey: keys.members(rootId) });
    queryClient.invalidateQueries({ queryKey: keys.assignees });
  };
  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Exclude<Role, 'owner'> }) => {
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
    mutationFn: async (role: Exclude<Role, 'owner'>) => {
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
    role: z.enum(['owner', 'editor', 'viewer']),
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
export function inviteUrl(token: string) {
  const base =
    process.env.EXPO_PUBLIC_WEB_URL ||
    (typeof window !== 'undefined' && window.location?.origin) ||
    'http://localhost:8081';
  return `${base.replace(/\/$/, '')}/invite/${token}`;
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
    mutationFn: async (input: { taskId: string; userId?: string; pendingName?: string }) => {
      const { error } = await supabase.from('task_assignees').insert({
        id: randomUUID(),
        task_id: input.taskId,
        user_id: input.userId ?? null,
        pending_name: input.userId ? null : (input.pendingName ?? null),
      });
      if (error) throw error;
    },
    onSettled: settle,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
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

/** Minhas tarefas: abertas e atribuídas a mim, de todos os projetos (ESCOPO 4.5). */
export function useMyTasks() {
  const { session } = useSession();
  return useQuery({
    queryKey: keys.mine,
    enabled: !!session,
    queryFn: async () => {
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
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
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
    mutationFn: async (id: string) => {
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
