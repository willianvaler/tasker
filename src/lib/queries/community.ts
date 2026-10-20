import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../supabase';
import { keys } from './keys';

// Comunidade (ESCOPO_V10 §4, D233): publicações com a cópia da estrutura. Só online.

export const COMMUNITY_KINDS = ['project', 'workout', 'menu', 'list', 'habits'] as const;
export type CommunityKind = (typeof COMMUNITY_KINDS)[number];

export type CommunityCard = {
  id: string;
  kind: CommunityKind;
  title: string;
  description: string | null;
  icon: string | null;
  locale: string;
  uses: number;
  likes: number;
  liked: boolean;
  mine: boolean;
  author_name: string;
  author_username: string;
  pages: number;
  items: number;
  created_at: string;
};

export type SnapshotItem = { title: string; notes?: string; children?: SnapshotItem[] };
export type CommunityPost = Omit<CommunityCard, 'pages' | 'items'> & {
  data: {
    pages: { name: string; icon: string | null; view_type: string; items: SnapshotItem[] }[];
  };
};

export type FeedFilter = {
  query?: string;
  kind?: CommunityKind | null;
  order?: 'popular' | 'new';
  mine?: boolean;
};

const PREFIX = ['community'] as const;

export function useCommunityFeed(filter: FeedFilter) {
  return useQuery({
    queryKey: [...PREFIX, 'feed', filter],
    queryFn: async (): Promise<CommunityCard[]> => {
      const { data, error } = await supabase.rpc('community_feed', {
        p_query: filter.query?.trim() || undefined,
        p_kind: filter.kind ?? undefined,
        p_order: filter.order ?? 'popular',
        p_mine: filter.mine ?? false,
        p_limit: 60,
      });
      if (error) throw error;
      return data as CommunityCard[];
    },
  });
}

export function useCommunityPost(id: string | undefined) {
  return useQuery({
    queryKey: [...PREFIX, 'post', id ?? ''],
    enabled: !!id,
    queryFn: async (): Promise<CommunityPost | null> => {
      const { data, error } = await supabase.rpc('community_post', { p_id: id ?? '' });
      if (error) throw error;
      return (data as CommunityPost | null) ?? null;
    },
  });
}

export type PublishSource = { folderId: string } | { pageId: string } | { templateId: string };

export function useCommunityActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: PREFIX });

  const publish = useMutation({
    mutationFn: async (input: {
      source: PublishSource;
      kind: CommunityKind;
      title: string;
      description: string;
      icon: string | null;
      locale: string;
    }) => {
      const { data, error } = await supabase.rpc('community_publish', {
        p_kind: input.kind,
        p_title: input.title,
        p_description: input.description || undefined,
        p_icon: input.icon ?? undefined,
        p_locale: input.locale,
        ...('folderId' in input.source
          ? { p_folder_id: input.source.folderId }
          : 'pageId' in input.source
            ? { p_page_id: input.source.pageId }
            : { p_template_id: input.source.templateId }),
      });
      if (error) throw error;
      return data;
    },
    onSettled: refresh,
  });

  const use = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('community_use', { p_id: id });
      if (error) throw error;
      return data;
    },
    onSettled: () => {
      refresh();
      queryClient.invalidateQueries({ queryKey: keys.tree });
    },
  });

  const like = useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      const { error } = await supabase.rpc('community_like', { p_id: id, p_on: on });
      if (error) throw error;
    },
    onMutate: ({ id, on }) => {
      // Na tela antes da resposta: em todas as listas e na prévia
      const flip = <T extends { id: string; liked: boolean; likes: number }>(c: T): T =>
        c.id === id && c.liked !== on ? { ...c, liked: on, likes: c.likes + (on ? 1 : -1) } : c;
      queryClient.setQueriesData<CommunityCard[]>({ queryKey: [...PREFIX, 'feed'] }, (list) =>
        list?.map(flip),
      );
      queryClient.setQueriesData<CommunityPost | null>({ queryKey: [...PREFIX, 'post'] }, (post) =>
        post ? flip(post) : post,
      );
    },
    onSettled: refresh,
  });

  const report = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.rpc('community_report', { p_id: id, p_reason: reason });
      if (error) throw error;
    },
    onSettled: refresh,
  });

  const unpublish = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('community_unpublish', { p_id: id });
      if (error) throw error;
    },
    onSettled: refresh,
  });

  return { publish, use, like, report, unpublish };
}
