import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { prepareImage } from '../image-prep';
import { supabase } from '../supabase';
import { uuidv7 } from '../uuid';
import { keys } from './keys';

// Modo competição do grupo (V6 §15.5, AC10.4/AC10.5, D184): desafios, ranking, mural e chat de um
// projeto ou de um time. Só online; o tempo real chega pelo useRealtimeSync.

/** O grupo: um projeto (pasta raiz) ou um time. */
export type Group = { kind: 'project' | 'team'; id: string };

export type Challenge = {
  id: string;
  folder_id: string | null;
  team_id: string | null;
  name: string;
  starts_on: string;
  /** Gerada no banco (início + dias − 1) */
  ends_on: string | null;
  days: number;
  created_by: string | null;
};

export type BoardRow = { user_id: string; display_name: string; days: string[] };

export type GroupPost = {
  id: string;
  user_id: string;
  kind: 'checkin' | 'message' | 'comment';
  parent_id: string | null;
  body: string;
  photo_path: string | null;
  created_at: string;
  reactions: { emoji: string; user_id: string }[];
};

export const REACTIONS = ['💪', '🔥', '👏', '❤️'] as const;
const BUCKET = 'group-photos';

const groupColumn = (g: Group) => (g.kind === 'project' ? 'folder_id' : 'team_id');
const groupKey = (g: Group) => [g.kind, g.id] as const;
export const challengeKeys = {
  list: (g: Group) => ['challenges', ...groupKey(g)] as const,
  one: (id: string) => ['challenges', 'one', id] as const,
  board: (id: string) => ['challenge-board', id] as const,
  posts: (g: Group) => ['group-posts', ...groupKey(g)] as const,
};

export function useGroupChallenges(group: Group | null) {
  return useQuery({
    queryKey: challengeKeys.list(group ?? { kind: 'project', id: '' }),
    enabled: !!group,
    queryFn: async (): Promise<Challenge[]> => {
      if (!group) return [];
      const { data, error } = await supabase
        .from('challenges')
        .select('id, folder_id, team_id, name, starts_on, ends_on, days, created_by')
        .eq(groupColumn(group), group.id)
        .order('ends_on', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useChallenge(id: string | undefined) {
  return useQuery({
    queryKey: challengeKeys.one(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<Challenge | null> => {
      const { data, error } = await supabase
        .from('challenges')
        .select('id, folder_id, team_id, name, starts_on, ends_on, days, created_by')
        .eq('id', id ?? '')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useChallengeBoard(id: string | undefined) {
  return useQuery({
    queryKey: challengeKeys.board(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<BoardRow[]> => {
      const { data, error } = await supabase.rpc('challenge_board', { p_challenge_id: id ?? '' });
      if (error) throw error;
      return data.map((r) => ({ ...r, days: r.days ?? [] }));
    },
  });
}

export function useChallengeActions(group: Group | null) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['challenges'] });

  const start = useMutation({
    mutationFn: async ({ name, days }: { name: string; days: number }) => {
      if (!group) throw new Error('grupo');
      const { data, error } = await supabase.rpc('start_challenge', {
        // Os tipos gerados não sabem que um dos dois vai nulo
        p_folder_id: (group.kind === 'project' ? group.id : null) as string,
        p_team_id: (group.kind === 'team' ? group.id : null) as string,
        p_name: name,
        p_days: days,
      });
      if (error) throw error;
      return data as string;
    },
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_challenge', { p_challenge_id: id });
      if (error) throw error;
    },
    onSettled: refresh,
  });

  return { start, remove };
}

/** Mural e chat: os posts do grupo, os mais novos primeiro, com as reações. */
export function useGroupPosts(group: Group | null) {
  return useQuery({
    queryKey: challengeKeys.posts(group ?? { kind: 'project', id: '' }),
    enabled: !!group,
    queryFn: async (): Promise<GroupPost[]> => {
      if (!group) return [];
      const { data, error } = await supabase
        .from('group_posts')
        .select(
          'id, user_id, kind, parent_id, body, photo_path, created_at, reactions:group_post_reactions(emoji, user_id)',
        )
        .eq(groupColumn(group), group.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as GroupPost[];
    },
  });
}

/** Endereços temporários das fotos (bucket privado). */
export function usePhotoUrls(paths: string[]) {
  const sorted = [...new Set(paths)].sort();
  return useQuery({
    queryKey: ['group-photos', sorted.join(',')],
    enabled: sorted.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(sorted, 3600);
      if (error) throw error;
      return Object.fromEntries(
        data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])),
      );
    },
  });
}

export type PhotoInput = { uri: string; width?: number; height?: number };

export function usePostActions(group: Group | null, userId: string | undefined) {
  const queryClient = useQueryClient();
  const key = challengeKeys.posts(group ?? { kind: 'project', id: '' });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: keys.notifications });
  };

  const send = useMutation({
    mutationFn: async (vars: {
      kind: GroupPost['kind'];
      body: string;
      parentId?: string;
      photo?: PhotoInput | null;
    }) => {
      if (!group || !userId) throw new Error('grupo');
      const id = uuidv7();
      let photoPath: string | null = null;
      if (vars.photo) {
        const { full } = await prepareImage(vars.photo.uri, vars.photo.width, vars.photo.height);
        photoPath = `${group.kind === 'project' ? 'f' : 't'}/${group.id}/${userId}/${id}.${full.ext}`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(photoPath, full.body, { contentType: full.mime, upsert: true });
        if (error) throw error;
      }
      const { error } = await supabase.from('group_posts').insert({
        id,
        folder_id: group.kind === 'project' ? group.id : null,
        team_id: group.kind === 'team' ? group.id : null,
        kind: vars.kind,
        parent_id: vars.parentId ?? null,
        body: vars.body.trim(),
        photo_path: photoPath,
      });
      if (error) {
        if (photoPath) await supabase.storage.from(BUCKET).remove([photoPath]);
        throw error;
      }
      return id;
    },
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: async (post: GroupPost) => {
      const { error } = await supabase.from('group_posts').delete().eq('id', post.id);
      if (error) throw error;
      if (post.photo_path) await supabase.storage.from(BUCKET).remove([post.photo_path]);
    },
    onSettled: refresh,
  });

  /** Liga ou desliga a minha reação, já na tela. */
  const react = useMutation({
    mutationFn: async ({ post, emoji }: { post: GroupPost; emoji: string }) => {
      const mine = post.reactions.some((r) => r.emoji === emoji && r.user_id === userId);
      const { error } = mine
        ? await supabase
            .from('group_post_reactions')
            .delete()
            .eq('post_id', post.id)
            .eq('emoji', emoji)
            .eq('user_id', userId ?? '')
        : await supabase.from('group_post_reactions').insert({ post_id: post.id, emoji });
      if (error) throw error;
    },
    onMutate: ({ post, emoji }) => {
      const previous = queryClient.getQueryData<GroupPost[]>(key);
      if (previous && userId) {
        queryClient.setQueryData(
          key,
          previous.map((p) => {
            if (p.id !== post.id) return p;
            const mine = p.reactions.some((r) => r.emoji === emoji && r.user_id === userId);
            return {
              ...p,
              reactions: mine
                ? p.reactions.filter((r) => !(r.emoji === emoji && r.user_id === userId))
                : [...p.reactions, { emoji, user_id: userId }],
            };
          }),
        );
      }
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: refresh,
  });

  return { send, remove, react };
}
