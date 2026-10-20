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
    is_gym: column.integer,
    gym_group: column.integer,
    position: column.real,
    archived: column.integer,
    created_at: column.text,
    kind: column.text,
    team_id: column.text,
    max_depth: column.integer,
    auto_complete_parent: column.integer,
    dependency_mode: column.text,
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
    source: column.text,
    custom_role_id: column.text,
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
    max_depth: column.integer,
    budget_cents: column.integer,
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
    depth: column.integer,
    estimate_minutes: column.integer,
    deps_mode: column.text,
    started_at: column.text,
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
    due_time: column.text,
    remind_before: column.integer,
    reminded_at: column.text,
    labels: column.text,
    done_cycle_key: column.text,
    habit_kind: column.text,
    habit_target: column.integer,
    count_up: column.integer,
    count_down: column.integer,
    count_key: column.text,
    habit_value: column.real,
    habit_value_day: column.text,
    habit_sides: column.text,
    // Visibilidade (V10 §2): private | friends | public
    visibility: column.text,
    repeat_plan: column.text,
    actual_minutes: column.integer,
    weight: column.integer,
    custom: column.text,
    approver_id: column.text,
    approver_role: column.text,
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

// Séries feitas pelo usuário (J1); id = "tarefa:pessoa". Só a RPC log_rep grava no servidor
const task_progress = new Table(
  {
    task_id: column.text,
    user_id: column.text,
    done_reps: column.integer,
    logged_values: column.text,
    cycle_key: column.text,
    updated_at: column.text,
  },
  { indexes: { task: ['task_id'] } },
);

// Temporizadores do usuário (J2). Só as RPCs start_timer/update_timer gravam no servidor
const timers = new Table(
  {
    user_id: column.text,
    task_id: column.text,
    kind: column.text,
    state: column.text,
    started_at: column.text,
    ends_at: column.text,
    paused_seconds: column.integer,
    ended_at: column.text,
    device_id: column.text,
    config: column.text,
    duration_seconds: column.integer,
    updated_at: column.text,
  },
  { indexes: { user: ['user_id', 'started_at'] } },
);

// Tempo registrado (K): pomodoro, cronômetro e manual. Só RPCs gravam
const time_entries = new Table(
  {
    user_id: column.text,
    task_id: column.text,
    folder_id: column.text,
    source: column.text,
    timer_id: column.text,
    started_at: column.text,
    ended_at: column.text,
    minutes: column.integer,
    note: column.text,
    created_at: column.text,
  },
  { indexes: { task: ['task_id'], user: ['user_id', 'started_at'] } },
);

// Envios de página que recebi (L): o "Recebidas" e o modo Executor
const page_shares = new Table(
  {
    page_id: column.text,
    owner_id: column.text,
    recipient_id: column.text,
    recipient_email: column.text,
    mode: column.text,
    status: column.text,
    copy_page_id: column.text,
    link_id: column.text,
    created_at: column.text,
    accepted_at: column.text,
    last_reminded_at: column.text,
  },
  { indexes: { page: ['page_id'] } },
);

// Marcações do aluno numa página recebida (L2), por ciclo
const share_checks = new Table(
  {
    task_id: column.text,
    page_id: column.text,
    user_id: column.text,
    cycle_key: column.text,
    done_at: column.text,
    note: column.text,
  },
  { indexes: { page: ['page_id', 'user_id'] } },
);

// Meu dia (M4): as tarefas que escolhi para um dia, em ordem
// Anotações (W3): texto simples, só da pessoa
const notes = new Table(
  {
    user_id: column.text,
    title: column.text,
    body: column.text,
    pinned: column.integer,
    // Anotação dentro de pasta ou projeto (20/10); vazio = só minha
    folder_id: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { updated: ['updated_at'], folder: ['folder_id'] } },
);

const my_day = new Table(
  {
    user_id: column.text,
    task_id: column.text,
    day: column.text,
    position: column.real,
    created_at: column.text,
  },
  { indexes: { day: ['user_id', 'day'] } },
);

// Campos personalizados da página (M5)
const page_fields = new Table(
  {
    page_id: column.text,
    folder_id: column.text,
    name: column.text,
    kind: column.text,
    options: column.text,
    position: column.real,
    created_at: column.text,
  },
  { indexes: { page: ['page_id'] } },
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

// Gastos (V9): um lançamento por linha, valor em centavos; a foto da nota fica no Storage
const expenses = new Table(
  {
    page_id: column.text,
    folder_id: column.text,
    spent_on: column.text,
    description: column.text,
    category: column.text,
    amount_cents: column.integer,
    currency: column.text,
    kind: column.text,
    paid_by: column.text,
    method: column.text,
    task_id: column.text,
    receipt_path: column.text,
    nfce_key: column.text,
    items: column.text,
    note: column.text,
    // Racha (PB5): ids de quem divide, em JSON
    split_among: column.text,
    created_by: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { page: ['page_id', 'spent_on'] } },
);

// Anexos (N1): só os dados; o arquivo fica no Storage e baixa ao abrir
const task_attachments = new Table(
  {
    task_id: column.text,
    folder_id: column.text,
    path: column.text,
    thumb_path: column.text,
    name: column.text,
    mime: column.text,
    size: column.integer,
    width: column.integer,
    height: column.integer,
    created_by: column.text,
    created_at: column.text,
  },
  { indexes: { task: ['task_id'] } },
);

// Anexo feito sem internet (N3): o arquivo já reduzido, em base64, até subir. Só no aparelho
const pending_uploads = new Table(
  {
    task_id: column.text,
    folder_id: column.text,
    path: column.text,
    thumb_path: column.text,
    name: column.text,
    mime: column.text,
    size: column.integer,
    width: column.integer,
    height: column.integer,
    body: column.text,
    thumb_body: column.text,
    thumb_mime: column.text,
    created_by: column.text,
    created_at: column.text,
    error: column.text,
  },
  { localOnly: true, indexes: { task: ['task_id'] } },
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
const task_dependencies = new Table(
  {
    task_id: column.text,
    depends_on_task_id: column.text,
    lag_minutes: column.integer,
    folder_id: column.text,
    created_by: column.text,
    created_at: column.text,
    updated_at: column.text,
    version: column.integer,
  },
  { indexes: { task: ['task_id'], dependsOn: ['depends_on_task_id'], folder: ['folder_id'] } },
);

// Lista que depende de outra (V3 §2.3)
const page_dependencies = new Table(
  {
    page_id: column.text,
    depends_on_page_id: column.text,
    threshold_pct: column.integer,
    folder_id: column.text,
    created_by: column.text,
    created_at: column.text,
    updated_at: column.text,
    version: column.integer,
  },
  { indexes: { page: ['page_id'], folder: ['folder_id'] } },
);

const milestones = new Table(
  {
    folder_id: column.text,
    name: column.text,
    due_date: column.text,
    done_at: column.text,
    position: column.real,
    created_by: column.text,
    created_at: column.text,
    updated_at: column.text,
    updated_by: column.text,
    version: column.integer,
  },
  { indexes: { folder: ['folder_id'] } },
);

// Cargos personalizados em uso nos meus projetos (grants chega como texto JSON)
const team_roles = new Table({ team_id: column.text, name: column.text, grants: column.text });

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
  gym_enabled: column.integer,
  ui_prefs: column.text,
  game_mode: column.text,
});

// Ações que viram RPC (concluir, habit_tick...): não ficam no SQLite, só na fila; o uploadData as
// executa na ordem pelo run_once, com o id da linha como chave de idempotência
const commands = new Table({ name: column.text, args: column.text }, { insertOnly: true });

export const AppSchema = new Schema({
  folders,
  folder_members,
  pages,
  tasks,
  task_progress,
  timers,
  time_entries,
  page_shares,
  share_checks,
  my_day,
  notes,
  page_fields,
  task_assignees,
  comments,
  task_attachments,
  expenses,
  pending_uploads,
  task_completions,
  conflict_copies,
  milestones,
  task_dependencies,
  page_dependencies,
  team_roles,
  people,
  profiles,
  commands,
});
export type LocalDatabase = (typeof AppSchema)['types'];
