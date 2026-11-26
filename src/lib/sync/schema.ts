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
    // Projeto de estudo (ES7)
    study: column.integer,
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
    // Regra de progressão do treino (AC6)
    progression: column.text,
    // Dias da semana do treino (AC9.5), JSON [1,3,5]
    train_days: column.text,
    // Base (OB8) e canvas (OB10): o filtro e as colunas, ou os nós e as setas (JSON)
    config: column.text,
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
    start_date: column.text,
    // Marco do projeto (GP3)
    milestone_id: column.text,
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
    // Exercício da biblioteca (AC3.8)
    exercise_id: column.text,
    // Progressão do exercício (AC6): regra e degrau próprios
    progression: column.text,
    progression_step: column.real,
    // Superset ou circuito (AC9.4): a letra do grupo
    superset: column.text,
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

// Diário de treino (AC4): cada série como aconteceu. Só log_rep/log_warmup gravam no servidor
const workout_sets = new Table(
  {
    user_id: column.text,
    task_id: column.text,
    page_id: column.text,
    session_id: column.text,
    exercise_id: column.text,
    exercise_name: column.text,
    cycle_key: column.text,
    set_index: column.integer,
    kind: column.text,
    weight_kg: column.real,
    reps: column.integer,
    duration_seconds: column.integer,
    distance_m: column.real,
    warmup: column.integer,
    effort: column.real,
    effort_scale: column.text,
    performed_at: column.text,
    records: column.text,
    target_reps: column.integer,
    target_sets: column.integer,
    target_seconds: column.integer,
  },
  { indexes: { task: ['task_id', 'cycle_key'], exercise: ['exercise_id', 'performed_at'] } },
);

// Remarcações de treino (AC9.5): só as minhas
const workout_moves = new Table(
  {
    page_id: column.text,
    user_id: column.text,
    from_day: column.text,
    to_day: column.text,
    created_at: column.text,
  },
  { indexes: { page: ['page_id', 'from_day'] } },
);

// Peso e medidas (AC7, dado sensível): só os meus. O consentimento só a RPC grava
const body_metrics = new Table(
  {
    user_id: column.text,
    kind: column.text,
    value: column.real,
    measured_on: column.text,
    note: column.text,
    created_at: column.text,
  },
  { indexes: { kind: ['kind', 'measured_on'] } },
);
const body_goals = new Table({
  user_id: column.text,
  kind: column.text,
  target: column.real,
  updated_at: column.text,
});
// Remédios do Bem-estar (BE4, dado sensível): só os meus
const medications = new Table({
  user_id: column.text,
  name: column.text,
  dose: column.real,
  times_per_day: column.integer,
  every_days: column.integer,
  pack_size: column.integer,
  stock: column.real,
  stock_on: column.text,
  paused: column.integer,
  notes: column.text,
  // SA3: arrays viram texto JSON no SQLite
  dose_times: column.text,
  weekdays: column.text,
  show_name: column.integer,
  created_at: column.text,
  updated_at: column.text,
});
// Histórico das doses (SA3, D385): id calculado do remédio, do dia e do horário
const medication_intakes = new Table({
  user_id: column.text,
  medication_id: column.text,
  day: column.text,
  slot: column.text,
  status: column.text,
  snoozes: column.integer,
  snoozed_until: column.text,
  acted_at: column.text,
});
// Repetição espaçada (ET1, D386): cartões só leitura (refeitos pelo servidor do texto das
// anotações) e o log das revisões, só de inserção; o estado é conta do app (lib/srs.ts)
const cards = new Table(
  {
    note_id: column.text,
    user_id: column.text,
    folder_id: column.text,
    question: column.text,
    answer: column.text,
    position: column.integer,
    created_at: column.text,
  },
  { indexes: { note: ['note_id'] } },
);
const card_reviews = new Table(
  {
    card_id: column.text,
    user_id: column.text,
    grade: column.integer,
    day: column.text,
    reviewed_at: column.text,
    created_at: column.text,
  },
  { indexes: { card: ['card_id'] } },
);
// Saúde (SA2, D383): preferências (id = a pessoa) e a água do dia
const health_settings = new Table({
  water_goal_ml: column.integer,
  cup_ml: column.integer,
  sleep_goal_min: column.integer,
  updated_at: column.text,
});
// Sono (SA1, D384): horas como 'HH:MM:SS'; a duração é conta do app
const sleep_logs = new Table({
  user_id: column.text,
  day: column.text,
  bed_time: column.text,
  wake_time: column.text,
  created_at: column.text,
});
const water_logs = new Table({
  user_id: column.text,
  ml: column.integer,
  day: column.text,
  logged_at: column.text,
  created_at: column.text,
});
// Equipamentos e manutenção (CS1, D365): next_on, task_id e prev_done_on são do servidor
const equipments = new Table({
  user_id: column.text,
  name: column.text,
  room: column.text,
  brand: column.text,
  model: column.text,
  purchased_on: column.text,
  device_id: column.text,
  notes: column.text,
  warranty_months: column.integer,
  warranty_until: column.text,
  expense_id: column.text,
  warranty_ends_on: column.text,
  warranty_warned: column.integer,
  created_at: column.text,
  updated_at: column.text,
});
const maintenance_plans = new Table({
  user_id: column.text,
  equipment_id: column.text,
  name: column.text,
  every_n: column.integer,
  unit: column.text,
  last_done_on: column.text,
  page_id: column.text,
  paused: column.integer,
  next_on: column.text,
  task_id: column.text,
  prev_done_on: column.text,
  created_at: column.text,
  updated_at: column.text,
});
const sensitive_consents = new Table({
  user_id: column.text,
  purpose: column.text,
  granted_at: column.text,
  revoked_at: column.text,
});

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
    group_id: column.text,
    // Plano do treinador para este aluno (AC13.2): JSON
    coach_plan: column.text,
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
    // Propriedades (OB4, D289): objeto JSON; etiquetas: lista JSON calculada pelo servidor (e pelo
    // app ao gravar sem internet, com o espelho noteTags)
    props: column.text,
    tags: column.text,
    // Modelo de anotação (OB5, D290): 0/1
    is_template: column.integer,
    // SHA-256 do texto em que a edição começou (ED6, D348): o servidor guarda o conflito
    body_base: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { updated: ['updated_at'], folder: ['folder_id'] } },
);

// Links [[...]] (OB1, D286): só leitura, refeitos pelo servidor a cada gravação do texto; os
// backlinks ("Citado em") vêm daqui também sem internet
const links = new Table(
  {
    source_kind: column.text,
    source_id: column.text,
    user_id: column.text,
    folder_id: column.text,
    target_kind: column.text,
    target_id: column.text,
    target_title: column.text,
    anchor: column.text,
    embed: column.integer,
    context: column.text,
    position: column.integer,
    created_at: column.text,
  },
  { indexes: { target: ['target_id'], source: ['source_kind', 'source_id'] } },
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
    /** Campo calculado (VS2): o texto da fórmula */
    formula: column.text,
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

// Biblioteca de exercícios (AC3.6): o catálogo (só leitura) e os próprios
const exercises = new Table(
  {
    name_en: column.text,
    name_pt: column.text,
    name_es: column.text,
    body_part: column.text,
    target: column.text,
    secondary: column.text,
    equipment: column.text,
    kind: column.text,
    level: column.text,
    mechanic: column.text,
    force: column.text,
    instructions: column.text,
    updated_at: column.text,
  },
  { indexes: { body: ['body_part'] } },
);

const user_exercises = new Table({
  owner_id: column.text,
  folder_id: column.text,
  name: column.text,
  body_part: column.text,
  target: column.text,
  equipment: column.text,
  kind: column.text,
  notes: column.text,
  created_at: column.text,
  updated_at: column.text,
});

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

// Anotação compartilhada (OB14, D300): quem recebe, a dona e o papel (read/edit). Sem id próprio no
// banco (a chave é anotação + pessoa): o id local é "anotação:pessoa", como o do folder_members
const note_shares = new Table(
  {
    note_id: column.text,
    user_id: column.text,
    owner_id: column.text,
    role: column.text,
    created_at: column.text,
  },
  { indexes: { note: ['note_id'] } },
);

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
// Automações pessoais (AU1): a regra é editada aqui e validada pelo banco ao subir
const automation_rules = new Table(
  {
    scope: column.text,
    owner_id: column.text,
    name: column.text,
    enabled: column.integer,
    definition: column.text,
    trigger_type: column.text,
    next_run_at: column.text,
    consecutive_failures: column.integer,
    disabled_reason: column.text,
    runs: column.integer,
    last_run_at: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { owner: ['owner_id'] } },
);

// Conector e dispositivos (V14 §8): o estado, sem segredo
const connectors = new Table({
  owner_id: column.text,
  kind: column.text,
  status: column.text,
  last_ok_at: column.text,
});

const devices = new Table(
  {
    owner_id: column.text,
    connector_id: column.text,
    name: column.text,
    category: column.text,
    capabilities: column.text,
    state: column.text,
    state_at: column.text,
    presumed: column.integer,
    online: column.integer,
    hidden: column.integer,
    sensitive: column.integer,
    last_command_at: column.text,
    updated_at: column.text,
  },
  { indexes: { owner: ['owner_id'] } },
);

const commands = new Table({ name: column.text, args: column.text }, { insertOnly: true });

export const AppSchema = new Schema({
  folders,
  folder_members,
  pages,
  tasks,
  task_progress,
  timers,
  time_entries,
  workout_sets,
  workout_moves,
  body_metrics,
  body_goals,
  sensitive_consents,
  medications,
  medication_intakes,
  cards,
  card_reviews,
  health_settings,
  water_logs,
  sleep_logs,
  equipments,
  maintenance_plans,
  page_shares,
  share_checks,
  my_day,
  notes,
  links,
  page_fields,
  task_assignees,
  comments,
  task_attachments,
  expenses,
  exercises,
  user_exercises,
  pending_uploads,
  task_completions,
  conflict_copies,
  milestones,
  task_dependencies,
  page_dependencies,
  team_roles,
  people,
  note_shares,
  profiles,
  automation_rules,
  connectors,
  devices,
  commands,
});
export type LocalDatabase = (typeof AppSchema)['types'];
