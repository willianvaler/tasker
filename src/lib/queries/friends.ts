import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../supabase';

// Amigos (ESCOPO_V10 §1, D230): nick, pedidos por nick ou e-mail e link de amizade. Só online; o
// tempo real chega pelo useRealtimeSync (friendships).

export const friendsKey = ['friends'] as const;

export type Friend = {
  user_id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  status: 'pending' | 'accepted';
  /** Pedido que recebi (e ainda não respondi) */
  incoming: boolean;
  since: string;
};

export type RequestResult = 'sent' | 'accepted' | 'already' | 'self' | 'not_found';

export function useMyFriends(enabled = true) {
  return useQuery({
    queryKey: friendsKey,
    enabled,
    queryFn: async (): Promise<Friend[]> => {
      const { data, error } = await supabase.rpc('my_friends');
      if (error) throw error;
      return data as Friend[];
    },
  });
}

/** Só os aceitos, para os seletores de grupo (AM3). */
export function useFriendsAccepted() {
  const all = useMyFriends();
  return { ...all, data: all.data?.filter((f) => f.status === 'accepted') };
}

export function useFriendActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: friendsKey });

  const request = useMutation({
    mutationFn: async (query: { username: string } | { email: string }) => {
      const { data, error } = await supabase.rpc(
        'friend_request',
        'email' in query ? { p_email: query.email } : { p_username: query.username },
      );
      if (error) throw error;
      return data as RequestResult;
    },
    onSettled: refresh,
  });

  const respond = useMutation({
    mutationFn: async ({ userId, accept }: { userId: string; accept: boolean }) => {
      const { error } = await supabase.rpc('friend_respond', { p_user: userId, p_accept: accept });
      if (error) throw error;
    },
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('friend_remove', { p_user: userId });
      if (error) throw error;
    },
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: friendsKey });
      const before = queryClient.getQueryData<Friend[]>(friendsKey);
      queryClient.setQueryData<Friend[]>(friendsKey, (list) =>
        list?.filter((f) => f.user_id !== userId),
      );
      return { before };
    },
    onError: (_e, _v, context) => queryClient.setQueryData(friendsKey, context?.before),
    onSettled: refresh,
  });

  return { request, respond, remove };
}

/** Meu link de amizade (token); reset troca e o antigo para de valer. */
export function useFriendLink() {
  const queryClient = useQueryClient();
  const key = ['friend-link'];
  const link = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('friend_link', {});
      if (error) throw error;
      return data;
    },
  });
  const reset = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('friend_link', { p_reset: true });
      if (error) throw error;
      return data;
    },
    onSuccess: (token) => queryClient.setQueryData(key, token),
  });
  return { link, reset };
}

export function useFriendLinkPreview(token: string | undefined) {
  return useQuery({
    queryKey: ['friend-link-preview', token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('friend_link_preview', { p_token: token ?? '' });
      if (error) throw error;
      return data[0] ?? null;
    },
  });
}

export function useAcceptFriendLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc('friend_link_accept', { p_token: token });
      if (error) throw error;
      return data;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: friendsKey }),
  });
}

/** Trocar o meu nick (o perfil em cache recarrega). */
export function useSetUsername() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => {
      const { data, error } = await supabase.rpc('set_username', { p_username: username });
      if (error) throw error;
      return data;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });
}
