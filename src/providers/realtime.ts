import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { keys, taskMutationKey } from '@/lib/queries/keys';
import { supabase } from '@/lib/supabase';
import { useSession } from './session';

// Tabela que mudou → listas que recarregam
const AFFECTS: Record<string, readonly (readonly string[])[]> = {
  // Tarefas mudam o progresso do projeto e o quadro do boss dele
  tasks: [keys.tasks, keys.game, ['board']],
  task_completions: [keys.tasks],
  task_assignees: [keys.assignees, keys.mine],
  comments: [['comments']],
  // Reações (PB2): na conclusão e nos comentários
  reactions: [['reactions']],
  // Amigos (V10): pedido recebido ou aceito aparece sem recarregar
  friendships: [['friends']],
  task_attachments: [['attachments']],
  activity_log: [['activity']],
  notifications: [keys.notifications],
  folder_members: [['members'], keys.tree],
  folders: [keys.tree],
  pages: [keys.tree],
  // Gastos (V9): o lançamento de outra pessoa aparece na planilha
  expenses: [['expenses']],
  // Anotações de pasta ou projeto (20/10): a de outra pessoa aparece sem recarregar
  notes: [['notes']],
  milestones: [['milestones']],
  task_dependencies: [keys.tasks, ['dependencies']],
  page_dependencies: [keys.tasks, ['dependencies'], ['page-dependencies']],
  bosses: [keys.game, ['project-boss'], ['board']],
  clan_activity: [keys.clan],
  clan_members: [keys.clan, keys.game],
  // Treinar junto (AC10.1): exercício atual, descanso e séries do grupo
  workout_sessions: [['workout-session'], ['workout-guest']],
  workout_session_members: [['workout-session'], ['workout-invites']],
  // Desafios do grupo (AC10.4): ranking, mural e chat
  challenges: [['challenges']],
  // Treino da Academia num grupo (AC15B): os treinos do grupo e os recebidos
  page_group_links: [['page-groups'], ['received']],
  group_posts: [['group-posts']],
  group_post_reactions: [['group-posts']],
};

/**
 * Tempo real: o que outra pessoa muda no projeto aparece sem recarregar. A RLS vale
 * para quem assina, então chegam só as mudanças que o usuário pode ver. Os eventos de uma mesma
 * leva (ex.: colar 10 tarefas) viram uma recarga só.
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      timer = null;
      for (const table of pending) {
        for (const key of AFFECTS[table] ?? []) {
          // As próprias mutações de tarefa já recarregam quando terminam (invalidateWhenIdle)
          if (key === keys.tasks && queryClient.isMutating({ mutationKey: taskMutationKey }) > 0)
            continue;
          queryClient.invalidateQueries({ queryKey: key });
        }
      }
      pending.clear();
    };

    let channel = supabase.channel(`sync:${userId}`);
    for (const table of Object.keys(AFFECTS)) {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(table === 'notifications' ? { filter: `user_id=eq.${userId}` } : {}),
        },
        () => {
          pending.add(table);
          if (!timer) timer = setTimeout(flush, 300);
        },
      );
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);
}
