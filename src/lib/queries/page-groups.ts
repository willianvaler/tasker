import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../supabase';
import { receivedKey } from './shares';

// Treino ↔ grupo nos dois sentidos (AC15B, D279): um treino da Academia ligado a grupos de treino.
// O treino segue da pessoa; os membros do grupo o recebem ao vivo (página enviada, D133). Só online.

export type GroupOption = {
  folder_id: string;
  name: string;
  icon: string | null;
  linked: boolean;
  members: number;
};

export type LinkedPage = {
  page_id: string;
  name: string;
  icon: string | null;
  view_type: string;
  owner_id: string | null;
  owner_name: string | null;
};

const optionsKey = (pageId: string) => ['page-groups', pageId] as const;
const linkedKey = (folderId: string) => ['page-groups', 'folder', folderId] as const;

/** Os grupos de treino em que dá para pôr este treino, com os já ligados. */
export function usePageGroupOptions(pageId: string | undefined) {
  return useQuery({
    queryKey: optionsKey(pageId ?? ''),
    enabled: !!pageId,
    queryFn: async (): Promise<GroupOption[]> => {
      const { data, error } = await supabase.rpc('page_group_options', { p_page_id: pageId ?? '' });
      if (error) throw error;
      return data;
    },
  });
}

/** Os treinos que membros puseram neste grupo. */
export function useGroupLinkedPages(folderId: string | undefined) {
  return useQuery({
    queryKey: linkedKey(folderId ?? ''),
    enabled: !!folderId,
    queryFn: async (): Promise<LinkedPage[]> => {
      const { data, error } = await supabase.rpc('group_linked_pages', {
        p_folder_id: folderId ?? '',
      });
      if (error) throw error;
      return data;
    },
  });
}

export function usePageGroupMutations() {
  const queryClient = useQueryClient();
  const settle = () => {
    queryClient.invalidateQueries({ queryKey: ['page-groups'] });
    queryClient.invalidateQueries({ queryKey: ['page-shares'] });
    queryClient.invalidateQueries({ queryKey: receivedKey });
  };
  return {
    /** Os grupos do treino passam a ser exatamente estes. */
    set: useMutation({
      mutationFn: async ({ pageId, folderIds }: { pageId: string; folderIds: string[] }) => {
        const { error } = await supabase.rpc('set_page_groups', {
          p_page_id: pageId,
          p_folder_ids: folderIds,
        });
        if (error) throw error;
      },
      onSettled: settle,
    }),
    /** Tirar um treino do grupo (quem pôs ou quem gerencia o grupo). */
    unlink: useMutation({
      mutationFn: async ({ pageId, folderId }: { pageId: string; folderId: string }) => {
        const { error } = await supabase.rpc('unlink_page_group', {
          p_page_id: pageId,
          p_folder_id: folderId,
        });
        if (error) throw error;
      },
      onSettled: settle,
    }),
  };
}
