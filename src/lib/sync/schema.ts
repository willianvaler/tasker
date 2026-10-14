import { column, Schema, Table } from '@powersync/common';

// Espelho local (SQLite) das tabelas da publicação `powersync`. O id é implícito; jsonb, arrays e
// datas chegam como texto, booleanos como 0/1.
const folders = new Table(
  {
    owner_id: column.text,
    parent_id: column.text,
    name: column.text,
    icon: column.text,
    color: column.text,
    is_shared: column.integer,
    is_inbox: column.integer,
    position: column.real,
    archived: column.integer,
    created_at: column.text,
    kind: column.text,
    updated_at: column.text,
    updated_by: column.text,
    version: column.integer,
  },
  { indexes: { parent: ['parent_id'] } },
);

const folder_members = new Table(
  {
    folder_id: column.text,
    user_id: column.text,
    role: column.text,
    joined_at: column.text,
    aliases: column.text,
  },
  { indexes: { folder: ['folder_id'] } },
);

const pages = new Table(
  {
    folder_id: column.text,
    name: column.text,
    icon: column.text,
    view_type: column.text,
    reset_cycle: column.text,
    is_inbox: column.integer,
    is_habits: column.integer,
    position: column.real,
    manual_cycle: column.integer,
    created_at: column.text,
    updated_at: column.text,
    updated_by: column.text,
    version: column.integer,
  },
  { indexes: { folder: ['folder_id'] } },
);

const tasks = new Table(
  {
    page_id: column.text,
    folder_id: column.text,
    parent_task_id: column.text,
    title: column.text,
    notes: column.text,
    status: column.text,
    priority: column.integer,
    recurrence: column.text,
    position: column.real,
    meta: column.text,
    created_by: column.text,
    completed_by: column.text,
    completed_at: column.text,
    created_at: column.text,
    updated_at: column.text,
    due_date: column.text,
    labels: column.text,
    done_cycle_key: column.text,
    habit_kind: column.text,
    habit_target: column.integer,
    count_up: column.integer,
    count_down: column.integer,
    count_key: column.text,
    updated_by: column.text,
    version: column.integer,
  },
  { indexes: { page: ['page_id'], due: ['due_date'] } },
);

// Chamadas de RPC feitas offline (concluir, habit_tick...): não ficam no SQLite, só na fila, e o
// uploadData as executa na ordem
const commands = new Table({ name: column.text, args: column.text }, { insertOnly: true });

export const AppSchema = new Schema({ folders, folder_members, pages, tasks, commands });
export type LocalDatabase = (typeof AppSchema)['types'];
