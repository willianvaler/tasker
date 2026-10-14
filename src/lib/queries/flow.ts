import { useQuery } from '@tanstack/react-query';

import type { FlowPerson, FlowTask } from '../flow-graph';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, toTask } from '../sync/local';
import { useProjectDependencies } from './dependencies';
import { usePageDeps } from './page-deps';
import { useAssignees, useMembers } from './projects';
import type { FolderNode } from './tree';

export type ProjectTask = FlowTask & {
  folder_id: string;
  due_date: string | null;
  created_at: string;
};

const COLUMNS =
  'id, title, page_id, folder_id, parent_task_id, status, completed_at, started_at, deps_mode, estimate_minutes, due_date, created_at';

/**
 * Todas as tarefas do projeto, subtarefas incluídas, com o que o Fluxo e a visão Pessoas usam.
 * A chave começa com 'tasks': recarrega e recebe as mudanças otimistas junto com as listas.
 */
export function useProjectAllTasks(root: Pick<FolderNode, 'id' | 'children'> | undefined) {
  const ids = root ? [root.id, ...root.children.map((c) => c.id)] : [];
  return useQuery({
    queryKey: ['tasks', 'project-all', root?.id ?? ''],
    enabled: !!root,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<ProjectTask[]> => {
      if (isLocal())
        return (
          await db.getAll<Record<string, unknown>>(
            `select ${COLUMNS} from tasks where folder_id in (select value from json_each(?))`,
            [JSON.stringify(ids)],
          )
        ).map((row) => toTask(row) as unknown as ProjectTask);
      const { data, error } = await supabase.from('tasks').select(COLUMNS).in('folder_id', ids);
      if (error) throw error;
      return data as ProjectTask[];
    },
  });
}

/** Tudo que as visões do projeto precisam: tarefas, ligações e quem cuida de cada uma. */
export function useProjectFlow(root: FolderNode | undefined) {
  const tasks = useProjectAllTasks(root);
  const dependencies = useProjectDependencies(root?.id);
  const assignees = useAssignees();
  const members = useMembers(root?.id);
  const pageDeps = usePageDeps(root);

  const byId = new Map((tasks.data ?? []).map((t) => [t.id, t]));
  const names = new Map((members.data ?? []).map((m) => [m.userId, m.displayName]));
  const people = new Map<string, FlowPerson[]>();
  for (const a of assignees.data ?? []) {
    if (!byId.has(a.task_id)) continue;
    const name = a.user_id ? names.get(a.user_id) : a.pending_name;
    if (!name) continue;
    people.set(a.task_id, [...(people.get(a.task_id) ?? []), { userId: a.user_id, name }]);
  }
  return {
    loading: tasks.isPending || dependencies.isPending,
    tasks: byId,
    deps: dependencies.data?.deps ?? [],
    people,
    members: members.data ?? [],
    blockedPages: pageDeps.blocked,
  };
}
