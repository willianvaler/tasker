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
  activity_log: [['activity']],
  notifications: [keys.notifications],
  folder_members: [['members'], keys.tree],
  folders: [keys.tree],
  pages: [keys.tree],
  bosses: [keys.game, ['project-boss'], ['board']],
  clan_activity: [keys.clan],
  clan_members: [keys.clan, keys.game],
};

/**
 * Tempo real (ESCOPO 4.5): o que outra pessoa muda no projeto aparece sem recarregar. A RLS vale
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
