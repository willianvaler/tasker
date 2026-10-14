import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Tables } from '../db';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, localInsert, runCommand, toTask } from '../sync/local';
import { uuidv7 } from '../uuid';
import { actorCan } from '../permissions';
import { taskState, type StateTask } from '../task-state';
import { keys, taskMutationKey } from './keys';
import { rootFolder, useFolderActor } from './projects';
import { invalidateWhenIdle, usePageTasks } from './tasks';
import { useTree } from './tree';
import { usePageDeps } from './page-deps';
import { useTranslation } from 'react-i18next';

export type Dependency = Tables<'task_dependencies'>;
/** Pré-requisito com o que a tela precisa (título e onde está). */
export type PrereqTask = StateTask & { title: string; page_id: string };

const PREREQ_COLUMNS =
  'id, parent_task_id, status, completed_at, started_at, deps_mode, title, page_id';

/**
 * Dependências de um projeto (ou pasta) inteiro e as tarefas que são pré-requisito, para calcular
 * o estado de cada tarefa (lib/task-state.ts). Lê do aparelho quando o sync está ligado.
 */
export function useProjectDependencies(rootId: string | undefined) {
  return useQuery({
    queryKey: keys.dependencies(rootId ?? ''),
    enabled: !!rootId,
    networkMode: isLocal() ? 'always' : 'online',
    // Lista (não Map): o cache salvo em disco é JSON, e um Map voltaria como objeto vazio
    queryFn: async (): Promise<{ deps: Dependency[]; prereqs: PrereqTask[] }> => {
      let deps: Dependency[];
      let prereqs: PrereqTask[] = [];
      if (isLocal()) {
        deps = await db.getAll<Dependency>(
          `select * from task_dependencies
           where folder_id in (select id from folders where id = ? or parent_id = ?)`,
          [rootId, rootId],
        );
        const ids = [...new Set(deps.map((d) => d.depends_on_task_id))];
        if (ids.length)
          prereqs = (
            await db.getAll<Record<string, unknown>>(
              `select ${PREREQ_COLUMNS} from tasks where id in (${ids.map(() => '?').join(',')})`,
              ids,
            )
          ).map((row) => toTask(row) as unknown as PrereqTask);
      } else {
        const folders = await supabase
          .from('folders')
          .select('id')
          .or(`id.eq.${rootId},parent_id.eq.${rootId}`);
        if (folders.error) throw folders.error;
        const result = await supabase
          .from('task_dependencies')
          .select('*')
          .in(
            'folder_id',
            folders.data.map((f) => f.id),
          );
        if (result.error) throw result.error;
        deps = result.data;
        const ids = [...new Set(deps.map((d) => d.depends_on_task_id))];
        if (ids.length) {
          const tasks = await supabase.from('tasks').select(PREREQ_COLUMNS).in('id', ids);
          if (tasks.error) throw tasks.error;
          prereqs = tasks.data as PrereqTask[];
        }
      }
      return { deps, prereqs };
    },
  });
}

/** Iniciar (S) ou parar. Offline vai pela fila (run_once). */
export function useStartTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: taskMutationKey,
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async ({ id, started }: { id: string; started: boolean }) => {
      if (isLocal()) {
        await runCommand('start_task', { p_task_id: id, p_started: started }, (tx) =>
          tx.execute('update tasks set started_at = ?, status = ? where id = ?', [
            started ? new Date().toISOString() : null,
            started ? 'doing' : 'todo',
            id,
          ]),
        );
        return;
      }
      const { error } = await supabase.rpc('start_task', { p_task_id: id, p_started: started });
      if (error) throw error;
    },
    onSettled: () => invalidateWhenIdle(queryClient),
  });
}

/** Forçar tarefa bloqueada (só no modo flexível, com task.force_unblock). Precisa de conexão. */
export function useForceTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'start' | 'complete' }) => {
      const { error } = await supabase.rpc('force_task', { p_task_id: id, p_action: action });
      if (error) throw error;
    },
    onSettled: () => {
      invalidateWhenIdle(queryClient);
      queryClient.invalidateQueries({ queryKey: keys.game });
    },
  });
}

/** Ligar e desligar pré-requisitos ("Depende de"). */
export function useDependencyMutations(rootId: string | undefined) {
  const queryClient = useQueryClient();
  const settle = () => {
    queryClient.invalidateQueries({ queryKey: keys.dependencies(rootId ?? '') });
    invalidateWhenIdle(queryClient);
  };
  const networkMode = isLocal() ? ('always' as const) : ('online' as const);
  return {
    add: useMutation({
      networkMode,
      mutationFn: async ({
        taskId,
        dependsOn,
        lag = 0,
      }: {
        taskId: string;
        dependsOn: string;
        lag?: number;
      }) => {
        const id = uuidv7();
        if (isLocal()) {
          const task = await db.getOptional<{ folder_id: string }>(
            'select folder_id from tasks where id = ?',
            [taskId],
          );
          const now = new Date().toISOString();
          await localInsert('task_dependencies', {
            id,
            task_id: taskId,
            depends_on_task_id: dependsOn,
            lag_minutes: lag,
            folder_id: task?.folder_id ?? null,
            created_at: now,
            updated_at: now,
            version: 1,
          });
          return;
        }
        // folder_id vem do trigger (a partir da tarefa); o cliente não manda
        const { error } = await supabase.from('task_dependencies').insert({
          id,
          task_id: taskId,
          depends_on_task_id: dependsOn,
          lag_minutes: lag,
        } as never);
        if (error) throw error;
      },
      onSettled: settle,
    }),
    setLag: useMutation({
      networkMode,
      mutationFn: async ({ id, lag }: { id: string; lag: number }) => {
        if (isLocal()) {
          await db.execute('update task_dependencies set lag_minutes = ? where id = ?', [lag, id]);
          return;
        }
        const { error } = await supabase
          .from('task_dependencies')
          .update({ lag_minutes: lag })
          .eq('id', id);
        if (error) throw error;
      },
      onSettled: settle,
    }),
    remove: useMutation({
      networkMode,
      mutationFn: async (id: string) => {
        if (isLocal()) {
          await db.execute('delete from task_dependencies where id = ?', [id]);
          return;
        }
        const { error } = await supabase.from('task_dependencies').delete().eq('id', id);
        if (error) throw error;
      },
      onSettled: settle,
    }),
  };
}

/** Estado de uma tarefa no fluxo (painel da tarefa), com o que ela espera e se dá para forçar. */
export function useTaskFlow(task: StateTask & { page_id: string; folder_id: string }) {
  const { t } = useTranslation();
  const tree = useTree();
  const root = rootFolder(tree.data, task.folder_id);
  const dependencies = useProjectDependencies(root?.id);
  const pageTasks = usePageTasks(task.page_id);
  const actor = useFolderActor(task.folder_id);
  const deps = dependencies.data?.deps ?? [];
  const all = new Map<string, StateTask & { title: string }>(
    [...(dependencies.data?.prereqs ?? []), ...(pageTasks.data ?? [])].map((t) => [
      t.id,
      t,
    ]),
  );
  if (!all.has(task.id)) all.set(task.id, { ...task, title: '' });
  // Lista que espera outra (V3 §2.3) também segura a tarefa
  const pageDeps = usePageDeps(root);
  const result = taskState(task.id, all, deps, new Date(), pageDeps.blocked);
  const pageWaits = result.pageBlocked
    ? pageDeps.blockersOf(task.page_id).map((w) =>
        t('pageDeps.waitingShort', {
          name: tree.data?.pages.find((p) => p.id === w.pageId)?.name ?? '…',
          pct: w.pct,
          threshold: w.threshold,
        }),
      )
    : [];
  return {
    ...result,
    waiting: [...result.waitingOn.map((id) => all.get(id)?.title ?? '…'), ...pageWaits],
    forceable: root?.dependency_mode === 'flexible' && actorCan(actor, 'task.force_unblock'),
    /** Ligações desta tarefa (Depende de) e de quem depende dela (Libera) */
    dependsOn: deps.filter((d) => d.task_id === task.id),
    unlocks: deps.filter((d) => d.depends_on_task_id === task.id),
    titleOf: (id: string) => all.get(id)?.title,
    canStart: actorCan(actor, 'task.start'),
  };
}

export type TaskOption = { id: string; title: string; status: string; page_id: string };

/** Todas as tarefas do projeto (subtarefas também), para buscar pré-requisitos pelo título. */
export function useProjectTaskOptions(rootId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['project-task-options', rootId],
    enabled: !!rootId && enabled,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<TaskOption[]> => {
      if (isLocal())
        return db.getAll<TaskOption>(
          `select id, title, status, page_id from tasks
           where folder_id in (select id from folders where id = ? or parent_id = ?)
           order by title`,
          [rootId, rootId],
        );
      const folders = await supabase
        .from('folders')
        .select('id')
        .or(`id.eq.${rootId},parent_id.eq.${rootId}`);
      if (folders.error) throw folders.error;
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, page_id')
        .in(
          'folder_id',
          folders.data.map((f) => f.id),
        )
        .order('title');
      if (error) throw error;
      return data;
    },
  });
}
