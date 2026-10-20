import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/providers/session';
import { toggled, type Reaction, type ReactionTarget } from '../reactions';
import { supabase } from '../supabase';

// Reações (PB2, D222): só online, como o mural do grupo; o tempo real chega pelo useRealtimeSync.

const PREFIX = ['reactions'] as const;

/** Reações das tarefas pedidas (da tarefa e dos comentários dela). */
export function useReactions(taskIds: string[]) {
  const ids = [...new Set(taskIds)].sort();
  return useQuery({
    queryKey: [...PREFIX, ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Reaction[]> => {
      const { data, error } = await supabase
        .from('reactions')
        .select('id, task_id, comment_id, user_id, emoji')
        .in('task_id', ids)
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

/** Liga ou desliga a minha reação, já na tela. */
export function useToggleReaction() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const me = session?.user.id;

  return useMutation({
    mutationFn: async ({
      target,
      emoji,
      mine,
    }: {
      target: ReactionTarget;
      emoji: string;
      mine: boolean;
    }) => {
      if (mine) {
        let query = supabase
          .from('reactions')
          .delete()
          .eq('task_id', target.taskId)
          .eq('emoji', emoji)
          .eq('user_id', me ?? '');
        query = target.commentId
          ? query.eq('comment_id', target.commentId)
          : query.is('comment_id', null);
        const { error } = await query;
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('reactions')
          .insert({ task_id: target.taskId, comment_id: target.commentId ?? null, emoji });
        if (error) throw error;
      }
    },
    onMutate: async ({ target, emoji }) => {
      await queryClient.cancelQueries({ queryKey: PREFIX });
      const saved = queryClient.getQueriesData<Reaction[]>({ queryKey: PREFIX });
      if (me) {
        const id = `local-${Date.now()}`;
        // Só as listas que incluem a tarefa (a chave leva os ids)
        const has = (key: readonly unknown[]) =>
          String(key[1] ?? '')
            .split(',')
            .includes(target.taskId);
        for (const [key, list] of saved)
          if (list && has(key)) queryClient.setQueryData(key, toggled(list, target, emoji, me, id));
      }
      return { saved };
    },
    onError: (_e, _v, context) => {
      for (const [key, data] of context?.saved ?? []) queryClient.setQueryData(key, data);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: PREFIX }),
  });
}
