import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';

import type { Json, Tables } from '../db';
import type { ParsedTask } from '../parser/quick';
import { todayIn } from '../parser/dates';
import { asRecurrence, nextDueDate } from '../recurrence';
import { supabase } from '../supabase';
import { completionSummarySchema, type CompletionSummary } from './game';
import { keys, taskMutationKey } from './keys';
import type { Page, Tree } from './tree';

export type Task = Tables<'tasks'>;
export type TaskWithPage = Task & {
  page: { name: string; icon: string | null; view_type?: string } | null;
};

const TASK_WITH_PAGE = '*, page:pages(name, icon, view_type)';

/** Todas as tarefas da página, inclusive subtarefas e concluídas. */
export function usePageTasks(pageId: string | undefined) {
  return useQuery({
    queryKey: keys.pageTasks(pageId ?? ''),
    enabled: !!pageId,
    queryFn: async () => {
      // Reabre o que ficou em ciclo vencido antes de ler (o cron também faz, a cada 15 min)
      await supabase.rpc('refresh_cycles', { p_page_id: pageId! });
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('page_id', pageId!)
        .order('position')
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

/** Tarefas abertas com vencimento até hoje (atrasadas + de hoje), de todas as páginas. */
export function useTodayTasks(today: string) {
  return useQuery({
    queryKey: keys.today(today),
    queryFn: async () => {
      await supabase.rpc('refresh_cycles', {});
      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_WITH_PAGE)
        .is('parent_task_id', null)
        .neq('status', 'done')
        .lte('due_date', today)
        .order('due_date')
        .order('priority', { ascending: false })
        .order('position');
      if (error) throw error;
      return data as TaskWithPage[];
    },
  });
}

export type HabitTask = Task & { page: { name: string; icon: string | null; view_type: string } };

/** Hábitos de todas as páginas do tipo hábitos (a tela Hoje filtra os agendados para hoje). */
export function useHabits(today: string) {
  return useQuery({
    queryKey: keys.habits(today),
    queryFn: async () => {
      await supabase.rpc('refresh_cycles', {});
      const { data, error } = await supabase
        .from('tasks')
        .select('*, page:pages!inner(name, icon, view_type)')
        .eq('page.view_type', 'habits')
        .is('parent_task_id', null)
        .order('position');
      if (error) throw error;
      return data as HabitTask[];
    },
  });
}

/** Datas (no fuso do usuário) em que cada tarefa foi concluída desde `since`. Para sequência e calendário. */
export function useCompletionDates(taskIds: string[], since: string, timeZone: string) {
  return useQuery({
    queryKey: ['tasks', 'completions', since, ...[...taskIds].sort()],
    enabled: taskIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_completions')
        .select('task_id, completed_at')
        .in('task_id', taskIds)
        .gte('completed_at', since);
      if (error) throw error;
      // Objeto simples (não Map): o cache é salvo em JSON para abrir offline
      const byTask: Record<string, string[]> = {};
      for (const c of data) {
        (byTask[c.task_id] ??= []).push(todayIn(timeZone, new Date(c.completed_at)));
      }
      return byTask;
    },
  });
}

/** Uma tarefa: primeiro procura nas listas em cache, depois busca no banco. */
export function useTask(id: string | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['tasks', 'one', id ?? ''],
    enabled: !!id,
    initialData: () => findCachedTask(queryClient, id!),
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function findCachedTask(queryClient: QueryClient, id: string): Task | undefined {
  for (const [, data] of queryClient.getQueriesData<Task[] | Task | null>({
    queryKey: keys.tasks,
  })) {
    if (Array.isArray(data)) {
      const found = data.find((t) => t.id === id);
      if (found) return found;
    } else if (data?.id === id) {
      return data;
    }
  }
  return undefined;
}

// ============================================================
// Atualização otimista
// ============================================================

/** Aplica a mudança em todas as listas de tarefas do cache (página, Hoje, tarefa avulsa). */
function patchTaskLists(queryClient: QueryClient, patch: (task: Task) => Task | null) {
  queryClient.setQueriesData<Task[] | Task | null>({ queryKey: keys.tasks }, (data) => {
    if (Array.isArray(data)) {
      return data.map(patch).filter((t): t is Task => t !== null);
    }
    return data ? patch(data) : data;
  });
}

/**
 * Só recarrega quando a última mutação de tarefa em sequência termina. Antes disso, o refetch
 * traria a lista sem as mudanças ainda em voo e elas "piscariam" na tela.
 */
function invalidateWhenIdle(queryClient: QueryClient) {
  if (queryClient.isMutating({ mutationKey: taskMutationKey }) === 1) {
    return queryClient.invalidateQueries({ queryKey: keys.tasks });
  }
}

async function snapshot(queryClient: QueryClient) {
  await queryClient.cancelQueries({ queryKey: keys.tasks });
  return queryClient.getQueriesData({ queryKey: keys.tasks });
}

function restore(queryClient: QueryClient, saved: [readonly unknown[], unknown][] | undefined) {
  saved?.forEach(([key, data]) => queryClient.setQueryData(key, data));
}

// ============================================================
// Criar (uma ou várias, sempre pelo create_tasks_batch)
// ============================================================

/** Responsável no formato do create_tasks_batch (membro ou nome pendente). */
export type NewAssignee = { user_id: string } | { pending_name: string };

type NewTask = ParsedTask & {
  done?: boolean;
  assignees?: NewAssignee[];
  children?: (ParsedTask & { done?: boolean; assignees?: NewAssignee[] })[];
};

type RpcItem = {
  id: string;
  title: string;
  priority: number;
  due_date: string | null;
  labels: string[];
  recurrence: ParsedTask['recurrence'];
  meta: ParsedTask['meta'];
  done: boolean;
  assignees: NewAssignee[];
  children: RpcItem[];
};

function toRpcItem(item: NewTask & { id: string }): RpcItem {
  return {
    id: item.id,
    title: item.title,
    priority: item.priority,
    due_date: item.dueDate,
    labels: item.labels,
    recurrence: item.recurrence,
    meta: item.meta,
    done: item.done ?? false,
    assignees: item.assignees ?? [],
    children: (item.children ?? []).map((c) => toRpcItem({ ...c, id: randomUUID() })),
  };
}

function optimisticTask(
  pageId: string,
  item: NewTask & { id: string },
  now: string,
  page?: Pick<Page, 'name' | 'icon'>,
): TaskWithPage {
  return {
    id: item.id,
    page_id: pageId,
    folder_id: '',
    parent_task_id: null,
    title: item.title,
    notes: null,
    status: item.done ? 'done' : 'todo',
    priority: item.priority,
    due_date: item.dueDate,
    labels: item.labels,
    recurrence: item.recurrence as Json,
    position: Number.MAX_SAFE_INTEGER,
    meta: item.meta as Json,
    done_cycle_key: null,
    created_by: '',
    completed_by: null,
    completed_at: item.done ? now : null,
    created_at: now,
    updated_at: now,
    page: page ? { name: page.name, icon: page.icon } : null,
  };
}

export function useCreateTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    ...offlineTaskMutation(createTasksKey),
    mutationFn: createTasksFn,
    onMutate: async ({ pageId, items }) => {
      const saved = await snapshot(queryClient);
      const now = new Date().toISOString();
      queryClient.setQueryData<Task[]>(keys.pageTasks(pageId), (tasks) => {
        if (!tasks) return tasks;
        let position = tasks
          .filter((t) => !t.parent_task_id)
          .reduce((m, t) => Math.max(m, t.position), 0);
        const optimistic: Task[] = items.map((item) => ({
          ...optimisticTask(pageId, item, now),
          position: ++position,
        }));
        return [...tasks, ...optimistic];
      });
      // Na tela Hoje, as que vencem até hoje já aparecem (página vem da árvore em cache)
      const page = queryClient.getQueryData<Tree>(keys.tree)?.pages.find((p) => p.id === pageId);
      for (const [key] of queryClient.getQueriesData<TaskWithPage[]>({
        queryKey: ['tasks', 'today'],
      })) {
        const today = key[2] as string;
        queryClient.setQueryData<TaskWithPage[]>(key, (tasks) =>
          tasks
            ? [
                ...tasks,
                ...items
                  .filter((i) => !i.done && i.dueDate && i.dueDate <= today)
                  .map((i) => optimisticTask(pageId, i, now, page)),
              ]
            : tasks,
        );
      }
      // Responsáveis aparecem na hora (o servidor confirma no onSettled)
      const newAssignees = items.flatMap((item) =>
        (item.assignees ?? []).map((a): Tables<'task_assignees'> => ({
          id: randomUUID(),
          task_id: item.id,
          folder_id: '',
          user_id: 'user_id' in a ? a.user_id : null,
          pending_name: 'pending_name' in a ? a.pending_name : null,
          created_by: null,
          created_at: now,
        })),
      );
      if (newAssignees.length) {
        queryClient.setQueryData<Tables<'task_assignees'>[]>(keys.assignees, (list) =>
          list ? [...list, ...newAssignees] : list,
        );
      }
      return { saved };
    },
    onError: (_err, _vars, context) => restore(queryClient, context?.saved),
    onSettled: (_data, _err, { items }) => {
      if (items.some((i) => i.assignees?.length)) {
        queryClient.invalidateQueries({ queryKey: keys.assignees });
        queryClient.invalidateQueries({ queryKey: keys.mine });
      }
      invalidateWhenIdle(queryClient);
      // [x] do lote conta para a sequência (Fase 3)
      if (items.some((i) => i.done)) queryClient.invalidateQueries({ queryKey: keys.game });
    },
  });
}

/** Atalho para criar uma subtarefa direto (sem sintaxe rápida). */
export function useCreateSubtask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: taskMutationKey,
    mutationFn: async ({ parent, title, id }: { parent: Task; title: string; id: string }) => {
      const { error } = await supabase.from('tasks').insert({
        id,
        page_id: parent.page_id,
        parent_task_id: parent.id,
        title,
        position: Date.now(),
      });
      if (error) throw error;
    },
    onSettled: () => invalidateWhenIdle(queryClient),
  });
}

// ============================================================
// Concluir / desfazer
// ============================================================

export function useToggleTask() {
  const queryClient = useQueryClient();

  return useMutation({
    ...offlineTaskMutation(toggleTaskKey),
    mutationFn: toggleTaskFn,
    onMutate: async ({ id, done, nextDue }) => {
      const saved = await snapshot(queryClient);
      const now = new Date().toISOString();
      patchTaskLists(queryClient, (t) => {
        if (t.id !== id) return t;
        // Recorrente comum: o servidor avança a data e a tarefa continua aberta (D25)
        if (done && nextDue) return { ...t, due_date: nextDue };
        return { ...t, status: done ? 'done' : 'todo', completed_at: done ? now : null };
      });
      return { saved };
    },
    onError: (_err, _vars, context) => restore(queryClient, context?.saved),
    onSettled: () => {
      invalidateWhenIdle(queryClient);
      // XP, bosses (solo, clã, projeto) e o quadro de contribuição mudam junto
      queryClient.invalidateQueries({ queryKey: keys.game });
      queryClient.invalidateQueries({ queryKey: ['project-boss'] });
      queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
}

// ============================================================
// Editar / mover / apagar
// ============================================================

export type TaskPatch = Partial<
  Pick<
    Task,
    | 'title'
    | 'notes'
    | 'priority'
    | 'due_date'
    | 'labels'
    | 'page_id'
    | 'position'
    | 'recurrence'
    | 'meta'
  >
>;

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    ...offlineTaskMutation(updateTaskKey),
    mutationFn: updateTaskFn,
    onMutate: async ({ id, patch }) => {
      const saved = await snapshot(queryClient);
      patchTaskLists(queryClient, (t) => (t.id === id ? { ...t, ...patch } : t));
      return { saved };
    },
    onError: (_err, _vars, context) => restore(queryClient, context?.saved),
    onSettled: () => invalidateWhenIdle(queryClient),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: taskMutationKey,
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      const saved = await snapshot(queryClient);
      patchTaskLists(queryClient, (t) => (t.id === id || t.parent_task_id === id ? null : t));
      return { saved };
    },
    onError: (_err, _vars, context) => restore(queryClient, context?.saved),
    onSettled: () => invalidateWhenIdle(queryClient),
  });
}

/**
 * Próximo vencimento se concluir esta tarefa só avança a data (recorrente fora de hábitos e de páginas
 * com reset; igual ao complete_task). null = concluir marca como feita.
 */
export function advanceOnComplete(
  task: Task,
  page: Pick<Page, 'view_type' | 'reset_cycle'> | undefined,
  today: string,
) {
  if (!page || task.parent_task_id || page.view_type === 'habits' || page.reset_cycle !== 'none')
    return null;
  return nextDueDate(asRecurrence(task.recurrence), task.due_date, today);
}

// ============================================================
// Fila offline (ESCOPO 9, Fase 5; D52): criar, marcar/desmarcar e editar/reordenar funcionam sem
// internet. O TanStack Query pausa a mutação, o cache persistido guarda a fila e, com a conexão
// de volta, reenvia na ordem (o scope único garante uma de cada vez). Depois de fechar e abrir o
// app, quem sabe executar é o setMutationDefaults (providers/query.tsx), com as funções abaixo.
// ============================================================

export const createTasksKey = [...taskMutationKey, 'create'] as const;
export const toggleTaskKey = [...taskMutationKey, 'toggle'] as const;
export const updateTaskKey = [...taskMutationKey, 'update'] as const;
export const statusTaskKey = [...taskMutationKey, 'status'] as const;

/** Mesma fila para todas as mutações de tarefa: a ordem de envio é a ordem em que foram feitas. */
const offlineTaskMutation = (mutationKey: readonly unknown[]) =>
  ({ mutationKey, scope: { id: 'tasks' } }) as const;

export type CreateTasksVars = { pageId: string; items: (NewTask & { id: string })[] };
export type ToggleTaskVars = { id: string; done: boolean; nextDue?: string | null };
export type UpdateTaskVars = { id: string; patch: TaskPatch };
export type TaskStatus = Task['status'];
export type StatusTaskVars = { id: string; status: TaskStatus };

export async function createTasksFn({ pageId, items }: CreateTasksVars) {
  const { error } = await supabase.rpc('create_tasks_batch', {
    p_page_id: pageId,
    p_items: items.map(toRpcItem) as unknown as Json,
  });
  if (error) throw error;
}

export async function toggleTaskFn({
  id,
  done,
}: ToggleTaskVars): Promise<CompletionSummary | null> {
  const { data, error } = await supabase.rpc(done ? 'complete_task' : 'uncomplete_task', {
    p_task_id: id,
  });
  if (error) throw error;
  // XP, nível, boss e conquistas vêm junto (Fase 3); se o formato mudar, a marcação vale igual
  return completionSummarySchema.safeParse(data).data ?? null;
}

/** Só os campos mudados vão para o servidor: em conflito, a última escrita vence por campo. */
export async function updateTaskFn({ id, patch }: UpdateTaskVars) {
  const { error } = await supabase.from('tasks').update(patch).eq('id', id);
  if (error) throw error;
}

/** Kanban: mover entre A fazer, Fazendo e Feito (Feito = concluir, com XP). */
export async function setTaskStatusFn({
  id,
  status,
}: StatusTaskVars): Promise<CompletionSummary | null> {
  const { data, error } = await supabase.rpc('set_task_status', {
    p_task_id: id,
    p_status: status,
  });
  if (error) throw error;
  return completionSummarySchema.safeParse(data).data ?? null;
}

/** Registra as funções da fila (para as mutações restauradas do disco depois de reabrir o app). */
export function registerOfflineTaskMutations(queryClient: QueryClient) {
  const settle = () => {
    invalidateWhenIdle(queryClient);
    queryClient.invalidateQueries({ queryKey: keys.game });
  };
  queryClient.setMutationDefaults(createTasksKey, {
    ...offlineTaskMutation(createTasksKey),
    mutationFn: (vars: CreateTasksVars) => createTasksFn(vars),
    onSettled: settle,
  });
  queryClient.setMutationDefaults(toggleTaskKey, {
    ...offlineTaskMutation(toggleTaskKey),
    mutationFn: (vars: ToggleTaskVars) => toggleTaskFn(vars),
    onSettled: settle,
  });
  queryClient.setMutationDefaults(updateTaskKey, {
    ...offlineTaskMutation(updateTaskKey),
    mutationFn: (vars: UpdateTaskVars) => updateTaskFn(vars),
    onSettled: settle,
  });
  queryClient.setMutationDefaults(statusTaskKey, {
    ...offlineTaskMutation(statusTaskKey),
    mutationFn: (vars: StatusTaskVars) => setTaskStatusFn(vars),
    onSettled: settle,
  });
}

export function useSetTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    ...offlineTaskMutation(statusTaskKey),
    mutationFn: setTaskStatusFn,
    onMutate: async ({ id, status }) => {
      const saved = await snapshot(queryClient);
      const now = new Date().toISOString();
      patchTaskLists(queryClient, (t) =>
        t.id === id ? { ...t, status, completed_at: status === 'done' ? now : null } : t,
      );
      return { saved };
    },
    onError: (_err, _vars, context) => restore(queryClient, context?.saved),
    onSettled: () => {
      invalidateWhenIdle(queryClient);
      queryClient.invalidateQueries({ queryKey: keys.game });
      queryClient.invalidateQueries({ queryKey: ['project-boss'] });
      queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
}
