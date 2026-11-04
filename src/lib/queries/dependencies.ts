import { onlineManager, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
export type PrereqTask = StateTask & {
  title: string;
  page_id: string;
  /** De outro projeto (PC2, D307): o nome dele, ou null para quem não é de lá */
  project?: string | null;
  outside?: true;
};
/** Tarefa de outro projeto que espera uma deste ("Libera"); `project` só para quem é de lá */
export type OutsideDependent = {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  title: string;
  status: string;
  project: string | null;
};
type CrossLinks = {
  prereqs: (Omit<PrereqTask, 'page_id' | 'parent_task_id'> & { project: string | null })[];
  dependents: OutsideDependent[];
};

const PREREQ_COLUMNS =
  'id, parent_task_id, status, completed_at, started_at, deps_mode, title, page_id';

/**
 * Dependências de um projeto (ou pasta) inteiro e as tarefas que são pré-requisito, para calcular
 * o estado de cada tarefa (lib/task-state.ts). Lê do aparelho quando o sync está ligado.
 */
export function useProjectDependencies(rootId: string | undefined) {
  const queryClient = useQueryClient();
  const key = keys.dependencies(rootId ?? '');
  return useQuery({
    queryKey: key,
    enabled: !!rootId,
    networkMode: isLocal() ? 'always' : 'online',
    // Lista (não Map): o cache salvo em disco é JSON, e um Map voltaria como objeto vazio
    queryFn: async (): Promise<{
      deps: Dependency[];
      prereqs: PrereqTask[];
      dependents: OutsideDependent[];
    }> => {
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
      // Ligações com outros projetos (PC2): o servidor dá o estado dos pré-requisitos de fora, que
      // quem não é de lá não lê, e quem de fora espera uma tarefa daqui. Sem conexão, o último que veio.
      const before = queryClient.getQueryData<{
        prereqs: PrereqTask[];
        dependents: OutsideDependent[];
      }>(key);
      let cross: { prereqs: PrereqTask[]; dependents: OutsideDependent[] } = {
        prereqs: before?.prereqs.filter((p) => p.outside) ?? [],
        dependents: before?.dependents ?? [],
      };
      if (onlineManager.isOnline())
        try {
          const { data, error } = await supabase.rpc('cross_project_links', {
            p_root: rootId ?? '',
          });
          if (error) throw error;
          const links = data as unknown as CrossLinks;
          cross = {
            prereqs: links.prereqs.map((p) => ({
              ...p,
              parent_task_id: null,
              page_id: '',
              outside: true,
            })),
            dependents: links.dependents,
          };
        } catch {}
      const outside = cross.prereqs.filter((p) => !prereqs.some((q) => q.id === p.id));
      // O que veio do aparelho (quem também é do outro projeto) ganha o nome do projeto
      const named = new Map(cross.prereqs.map((p) => [p.id, p.project]));
      prereqs = [
        ...prereqs.map((p) =>
          named.has(p.id) ? { ...p, project: named.get(p.id), outside: true as const } : p,
        ),
        ...outside,
      ];
      return { deps, prereqs, dependents: cross.dependents };
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
    [...(dependencies.data?.prereqs ?? []), ...(pageTasks.data ?? [])].map((t) => [t.id, t]),
  );
  if (!all.has(task.id)) all.set(task.id, { ...task, title: '' });
  // Lista que espera outra (V3 §2.3) também segura a tarefa
  const pageDeps = usePageDeps(root);
  const result = taskState(task.id, all, deps, new Date(), pageDeps.blocked);
  const outsideUnlocks = (dependencies.data?.dependents ?? []).filter(
    (d) => d.depends_on_task_id === task.id,
  );
  const outsideById = new Map<string, { title: string; project: string | null }>([
    ...(dependencies.data?.prereqs ?? [])
      .filter((p) => p.outside)
      .map((p) => [p.id, { title: p.title, project: p.project ?? null }] as const),
    ...outsideUnlocks.map((d) => [d.task_id, { title: d.title, project: d.project }] as const),
  ]);
  const pageWaits = result.pageBlocked
    ? pageDeps.blockersOf(task.page_id).map((w) =>
        t('pageDeps.waitingShort', {
          name: tree.data?.pages.find((p) => p.id === w.pageId)?.name ?? '…',
          pct: w.pct,
          threshold: w.threshold,
        }),
      )
    : [];
  const titleOf = (id: string) => {
    const outside = outsideById.get(id);
    if (outside)
      return t('flow.outsideTitle', {
        title: outside.title,
        project: outside.project ?? t('flow.otherProject'),
      });
    return all.get(id)?.title;
  };
  return {
    ...result,
    waiting: [...result.waitingOn.map((id) => titleOf(id) ?? '…'), ...pageWaits],
    forceable: root?.dependency_mode === 'flexible' && actorCan(actor, 'task.force_unblock'),
    /** Ligações desta tarefa (Depende de) e de quem depende dela (Libera), daqui e de fora */
    dependsOn: deps.filter((d) => d.task_id === task.id),
    unlocks: [
      ...deps.filter((d) => d.depends_on_task_id === task.id),
      ...outsideUnlocks.map((d) => ({ id: d.id, task_id: d.task_id, outside: true as const })),
    ],
    titleOf,
    /** Tarefa de outro projeto em que a pessoa não está: não abre */
    canOpen: (id: string) => !outsideById.has(id) || outsideById.get(id)?.project != null,
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

export type OutsideOption = TaskOption & { project: string };

/**
 * Tarefas de outros projetos e pastas da pessoa com o título parecido, para depender delas (PC2,
 * D307). Só busca a partir de 2 letras e no máximo 8; quem decide se pode é o banco (precisa
 * editar no outro projeto).
 */
export function useOutsideTaskOptions(rootId: string | undefined, query: string) {
  const tree = useTree();
  const term = query.trim();
  const others = (tree.data?.folders ?? []).filter((f) => f.id !== rootId);
  const projectOf = new Map(
    others.flatMap((f) => [f, ...f.children].map((c) => [c.id, f.name] as const)),
  );
  const ids = [...projectOf.keys()];
  return useQuery({
    queryKey: ['outside-task-options', rootId, term],
    enabled: !!rootId && term.length >= 2 && ids.length > 0,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<OutsideOption[]> => {
      const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      let rows: (TaskOption & { folder_id: string })[];
      if (isLocal())
        rows = await db.getAll(
          `select id, title, status, page_id, folder_id from tasks
           where folder_id in (${ids.map(() => '?').join(',')}) and title like ? escape '\\'
           order by title limit 8`,
          [...ids, like],
        );
      else {
        const { data, error } = await supabase
          .from('tasks')
          .select('id, title, status, page_id, folder_id')
          .in('folder_id', ids)
          .ilike('title', like)
          .order('title')
          .limit(8);
        if (error) throw error;
        rows = data;
      }
      return rows.map(({ folder_id, ...r }) => ({ ...r, project: projectOf.get(folder_id) ?? '' }));
    },
  });
}
