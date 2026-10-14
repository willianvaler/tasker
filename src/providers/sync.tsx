import { PowerSyncContext } from '@powersync/react';
import { useEffect, type ReactNode } from 'react';

import { keys, taskMutationKey } from '@/lib/queries/keys';
import { connector, POWERSYNC_URL, setOnCommandApplied } from '@/lib/sync/connector';
import { db } from '@/lib/sync/db';
import { pendingXp } from '@/lib/sync/pending-xp';
import { queryClient } from '@/providers/query';
import { useSession } from '@/providers/session';

// Tabela local que mudou → consultas que releem
const AFFECTS: Record<string, readonly (readonly unknown[])[]> = {
  tasks: [keys.tasks],
  task_completions: [keys.tasks],
  task_assignees: [keys.tasks, keys.assignees],
  comments: [keys.tasks, ['comments']],
  conflict_copies: [keys.tasks],
  folders: [keys.tree],
  pages: [keys.tree, keys.tasks],
  folder_members: [keys.tree, ['members']],
  people: [['members'], ['comments']],
};

// Banco local e cache pelo console (e pelos testes de dois aparelhos): são os dados de quem está
// logado, no navegador dele
if (typeof window !== 'undefined')
  Object.assign(window, { questlistDb: db, questlistQueries: queryClient });

export function SyncProvider({ children }: { children: ReactNode }) {
  const { session, isLoading } = useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (isLoading || !POWERSYNC_URL) return;
    // Saiu da conta: os dados de quem saiu não ficam no aparelho
    if (!userId) {
      pendingXp.clear();
      db.disconnectAndClear();
    } else db.connect(connector, { crudUploadThrottleMs: 0 });
  }, [isLoading, userId]);

  useEffect(() => {
    // Comando aplicado no servidor: XP, boss e quadro oficiais substituem a estimativa
    let timer: ReturnType<typeof setTimeout> | undefined;
    setOnCommandApplied(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: keys.game });
        queryClient.invalidateQueries({ queryKey: ['project-boss'] });
        queryClient.invalidateQueries({ queryKey: ['board'] });
      }, 300);
    });
    return () => setOnCommandApplied(() => {});
  }, []);

  useEffect(() => {
    if (!POWERSYNC_URL) return;
    // Na primeira sincronização completa as telas trocam o Supabase pelo banco do aparelho
    let synced = !!db.currentStatus.hasSynced;
    const stopStatus = db.registerListener({
      statusChanged: (status) => {
        if (status.hasSynced && !synced) {
          // Só o que passa a ler do aparelho (o resto continua no Supabase)
          for (const key of [keys.tasks, keys.tree, keys.assignees, ['members'], ['comments']])
            queryClient.invalidateQueries({ queryKey: key });
        }
        synced = !!status.hasSynced;
      },
    });
    const stopChanges = db.onChange(
      {
        onChange: (event) => {
          const done = new Set<string>();
          // Com mutação de tarefa em andamento, quem relê é o onSettled dela (invalidateWhenIdle):
          // reler agora tiraria da tela a linha que acabou de ser marcada antes da resposta
          if (queryClient.isMutating({ mutationKey: taskMutationKey }) > 0)
            done.add(JSON.stringify(keys.tasks));
          for (const table of event.changedTables) {
            for (const key of AFFECTS[table.replace(/^ps_data__/, '')] ?? []) {
              const id = JSON.stringify(key);
              if (done.has(id)) continue;
              done.add(id);
              queryClient.invalidateQueries({ queryKey: key });
            }
          }
        },
      },
      { tables: Object.keys(AFFECTS), throttleMs: 30 },
    );
    return () => {
      stopStatus();
      stopChanges();
    };
  }, []);

  return <PowerSyncContext.Provider value={db}>{children}</PowerSyncContext.Provider>;
}
