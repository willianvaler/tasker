// Chaves do TanStack Query. Toda lista de tarefas começa com 'tasks', para a atualização otimista
// poder ajustar todas de uma vez (patchTaskLists).
export const keys = {
  profile: ['profile'] as const,
  game: ['game'] as const,
  tree: ['tree'] as const,
  tasks: ['tasks'] as const,
  pageTasks: (pageId: string) => ['tasks', 'page', pageId] as const,
  today: (today: string) => ['tasks', 'today', today] as const,
  habits: (today: string) => ['tasks', 'habits', today] as const,
  /** Minhas tarefas (atribuídas a mim): começa com 'tasks' para a atualização otimista valer */
  mine: ['tasks', 'mine'] as const,
  folderTasks: (rootId: string) => ['tasks', 'folder', rootId] as const,
  members: (rootId: string) => ['members', rootId] as const,
  assignees: ['assignees'] as const,
  comments: (taskId: string) => ['comments', taskId] as const,
  activity: (rootId: string) => ['activity', rootId] as const,
  notifications: ['notifications'] as const,
  templates: ['templates'] as const,
  clan: ['clan'] as const,
  projectBoss: (rootId: string) => ['project-boss', rootId] as const,
  board: (bossId: string) => ['board', bossId] as const,
};

/** Toda mutação de tarefa usa esta chave (ver invalidateWhenIdle). */
export const taskMutationKey = ['tasks', 'mutation'] as const;
