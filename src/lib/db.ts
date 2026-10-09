import type { Database as Generated } from './database.types';

export type { Json } from './database.types';

// Ajustes nos tipos gerados (`npm run db:types` sobrescreve o database.types.ts, não este arquivo).
// O folder_id das tarefas, responsáveis e comentários é preenchido por trigger e o cliente não tem
// permissão de enviá-lo.
type GenTables = Generated['public']['Tables'];

type WithoutFolderId<T extends 'tasks' | 'task_assignees' | 'comments'> = Omit<
  GenTables[T],
  'Insert' | 'Update'
> & {
  Insert: Omit<GenTables[T]['Insert'], 'folder_id'>;
  Update: Omit<GenTables[T]['Update'], 'folder_id'>;
};

export type Database = Omit<Generated, 'public'> & {
  public: Omit<Generated['public'], 'Tables'> & {
    Tables: Omit<GenTables, 'tasks' | 'task_assignees' | 'comments'> & {
      tasks: WithoutFolderId<'tasks'>;
      task_assignees: WithoutFolderId<'task_assignees'>;
      comments: WithoutFolderId<'comments'>;
    };
  };
};

export type Tables<T extends keyof GenTables> = GenTables[T]['Row'];
