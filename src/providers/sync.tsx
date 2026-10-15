import { PowerSyncContext } from '@powersync/react';
import { useEffect, type ReactNode } from 'react';

import { keys, taskMutationKey } from '@/lib/queries/keys';
import { connector, POWERSYNC_URL, setOnCommandApplied } from '@/lib/sync/connector';
import { db } from '@/lib/sync/db';
import { pendingXp } from '@/lib/sync/pending-xp';
import { supabase } from '@/lib/supabase';
import { getSyncUser, setSyncUser } from '@/lib/prefs';
import { queryClient } from '@/providers/query';
import { useSession } from '@/providers/session';

// Tabela local que mudou → consultas que releem
const AFFECTS: Record<string, readonly (readonly unknown[])[]> = {
  tasks: [keys.tasks, ['project-task-options'], ['dependencies']],
  task_completions: [keys.tasks],
  task_assignees: [keys.tasks, keys.assignees],
  comments: [keys.tasks, ['comments']],
  conflict_copies: [keys.tasks],
  folders: [keys.tree],
  pages: [keys.tree, keys.tasks],
  folder_members: [keys.tree, ['members']],
  milestones: [['milestones']],
  task_dependencies: [keys.tasks, ['dependencies']],
  page_dependencies: [keys.tasks, ['dependencies'], ['page-dependencies']],
  people: [['members'], ['comments']],
  task_progress: [keys.progress],
  timers: [keys.timer],
  time_entries: [keys.timeEntries],
};

// Consultas com ramo local: as do AFFECTS
const LOCAL_KEYS = new Set(
  Object.values(AFFECTS).flatMap((list) => list.map((k) => JSON.stringify(k))),
);

// Banco local e cache pelo console (e pelos testes de dois aparelhos): são os dados de quem está
// logado, no navegador dele
if (typeof window !== 'undefined')
  Object.assign(window, { questlistDb: db, questlistQueries: queryClient });

async function clearLocal() {
  pendingXp.clear();
  await db.disconnectAndClear();
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { session, isLoading } = useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (isLoading || !POWERSYNC_URL || !userId) return;
    (async () => {
      // Outra conta neste aparelho: o banco de quem estava antes não fica
      const previous = getSyncUser();
      if (previous && previous !== userId) await clearLocal();
      setSyncUser(userId);
      await db.connect(connector, { crudUploadThrottleMs: 0 });
    })();
  }, [isLoading, userId]);

  useEffect(() => {
    if (!POWERSYNC_URL) return;
    // Só o "sair" de verdade limpa. Sessão nula por um instante (renovação do token sem rede) não
    // pode apagar o banco do aparelho, que tem a fila do que ainda não subiu
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT') return;
      setSyncUser(null);
      clearLocal();
    });
    return () => data.subscription.unsubscribe();
  }, []);

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
    let tasksStale = false;
    const settle = new Set<string>();
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const stopStatus = db.registerListener({
      statusChanged: (status) => {
        if (status.hasSynced && !synced) {
          // Tudo que passa a ler do aparelho (o resto continua no Supabase). Faltando uma chave,
          // a consulta fica com o que o servidor tinha antes da fila subir (ex.: a lista que
          // depende de outra recarregava sem a ligação recém-feita)
          for (const id of LOCAL_KEYS) queryClient.invalidateQueries({ queryKey: JSON.parse(id) });
        }
        synced = !!status.hasSynced;
      },
    });
    const stopChanges = db.onChange(
      {
        onChange: (event) => {
          const done = new Set<string>();
          // Com mutação de tarefa em andamento, relê só quando ela terminar: reler agora tiraria da
          // tela a linha que acabou de ser marcada antes da resposta
          if (queryClient.isMutating({ mutationKey: taskMutationKey }) > 0) {
            tasksStale = true;
            done.add(JSON.stringify(keys.tasks));
          }
          const changed: (readonly unknown[])[] = [];
          for (const table of event.changedTables) {
            for (const key of AFFECTS[table.replace(/^ps_data__/, '')] ?? []) {
              const id = JSON.stringify(key);
              if (done.has(id)) continue;
              done.add(id);
              changed.push(key);
              queryClient.invalidateQueries({ queryKey: key });
            }
          }
          // E de novo quando o banco assentar: ao trocar a linha criada no aparelho pela que veio
          // do servidor, uma leitura no meio pode não achar nenhuma das duas
          for (const key of changed) settle.add(JSON.stringify(key));
          clearTimeout(settleTimer);
          settleTimer = setTimeout(() => {
            for (const id of settle) queryClient.invalidateQueries({ queryKey: JSON.parse(id) });
            settle.clear();
          }, 400);
        },
      },
      { tables: Object.keys(AFFECTS), throttleMs: 30 },
    );
    const stopMutations = queryClient.getMutationCache().subscribe(() => {
      if (!tasksStale || queryClient.isMutating({ mutationKey: taskMutationKey }) > 0) return;
      tasksStale = false;
      queryClient.invalidateQueries({ queryKey: keys.tasks });
    });
    return () => {
      clearTimeout(settleTimer);
      stopStatus();
      stopChanges();
      stopMutations();
    };
  }, []);

  return <PowerSyncContext.Provider value={db}>{children}</PowerSyncContext.Provider>;
}
