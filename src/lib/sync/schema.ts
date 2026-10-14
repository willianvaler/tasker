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
  {
    indexes: { page: ['page_id'], due: ['due_date'] },
    // A versão anterior de notas e etiquetas vai junto no envio (conflito e conjunto, D5)
    trackPrevious: { columns: ['notes', 'labels'], onlyWhenChanged: true },
    ignoreEmptyUpdates: true,
  },
);

const task_assignees = new Table(
  {
    task_id: column.text,
    folder_id: column.text,
    user_id: column.text,
    pending_name: column.text,
    created_by: column.text,
    created_at: column.text,
  },
  { indexes: { task: ['task_id'], user: ['user_id'] } },
);

const comments = new Table(
  {
    task_id: column.text,
    folder_id: column.text,
    author_id: column.text,
    body: column.text,
    created_at: column.text,
  },
  { indexes: { task: ['task_id'] } },
);

const task_completions = new Table(
  {
    task_id: column.text,
    folder_id: column.text,
    user_id: column.text,
    completed_at: column.text,
    cycle_key: column.text,
    prev_due_date: column.text,
  },
  { indexes: { task: ['task_id', 'completed_at'] } },
);

// Versões de notas que perderam num conflito ("ver versão anterior")
const conflict_copies = new Table(
  {
    task_id: column.text,
    folder_id: column.text,
    field: column.text,
    body: column.text,
    replaced_by: column.text,
    created_at: column.text,
  },
  { indexes: { task: ['task_id'] } },
);

// De quem divide pasta comigo, só nome e avatar
const people = new Table({ display_name: column.text, avatar_url: column.text });

// O meu perfil inteiro (fuso, idioma, gamificação)
const profiles = new Table({
  display_name: column.text,
  avatar_url: column.text,
  timezone: column.text,
  gamification_enabled: column.integer,
  xp: column.integer,
  level: column.integer,
  coins: column.integer,
  streak: column.integer,
  streak_best: column.integer,
  last_active_date: column.text,
  created_at: column.text,
  onboarded_at: column.text,
  class: column.text,
  attr_str: column.integer,
  attr_agi: column.integer,
  attr_int: column.integer,
  attr_con: column.integer,
  skill_day: column.text,
  equipped: column.text,
  locale: column.text,
});

// Ações que viram RPC (concluir, habit_tick...): não ficam no SQLite, só na fila; o uploadData as
// executa na ordem pelo run_once, com o id da linha como chave de idempotência
const commands = new Table({ name: column.text, args: column.text }, { insertOnly: true });

export const AppSchema = new Schema({
  folders,
  folder_members,
  pages,
  tasks,
  task_assignees,
  comments,
  task_completions,
  conflict_copies,
  people,
  profiles,
  commands,
});
export type LocalDatabase = (typeof AppSchema)['types'];
