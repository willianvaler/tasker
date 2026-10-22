import {
  UpdateType,
  type AbstractPowerSyncDatabase,
  type CrudEntry,
  type PowerSyncBackendConnector,
} from '@powersync/common';

import type { Json } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

import { pendingXp } from './pending-xp';

// Sem a variável, o app não sincroniza (o banco local fica vazio e as telas usam o Supabase)
const envUrl = process.env.EXPO_PUBLIC_POWERSYNC_URL;
export const POWERSYNC_URL = envUrl?.startsWith('/')
  ? `${globalThis.location?.origin ?? ''}${envUrl}`
  : (envUrl ?? null);

// O que o cliente pode gravar em cada tabela (os mesmos grants do banco). O resto do que muda no
// aparelho (status, contagens, XP) é efeito de uma RPC da tabela `commands` e volta pelo sync.
const WRITABLE: Record<string, { insert: string[]; update: string[] }> = {
  folders: {
    insert: ['name', 'parent_id', 'icon', 'color', 'position', 'kind', 'gym_group'],
    update: [
      'name',
      'icon',
      'color',
      'position',
      'archived',
      'kind',
      'max_depth',
      'auto_complete_parent',
      'dependency_mode',
    ],
  },
  pages: {
    insert: [
      'folder_id',
      'name',
      'icon',
      'view_type',
      'reset_cycle',
      'position',
      'max_depth',
      'budget_cents',
      'progression',
      'train_days',
    ],
    update: [
      'folder_id',
      'name',
      'icon',
      'view_type',
      'reset_cycle',
      'position',
      'max_depth',
      'budget_cents',
      'progression',
      'train_days',
    ],
  },
  tasks: {
    insert: [
      'page_id',
      'parent_task_id',
      'title',
      'notes',
      'priority',
      'due_date',
      'due_time',
      'remind_before',
      'labels',
      'meta',
      'recurrence',
      'position',
      'habit_kind',
      'habit_target',
      'habit_sides',
      'estimate_minutes',
      'deps_mode',
      'repeat_plan',
      'weight',
      'custom',
      'approver_id',
      'approver_role',
      'visibility',
      'exercise_id',
      'progression',
      'progression_step',
      'superset',
    ],
    update: [
      'page_id',
      'parent_task_id',
      'title',
      'notes',
      'priority',
      'due_date',
      'due_time',
      'remind_before',
      'labels',
      'meta',
      'recurrence',
      'position',
      'habit_kind',
      'habit_target',
      'habit_sides',
      'estimate_minutes',
      'deps_mode',
      'repeat_plan',
      'weight',
      'custom',
      'approver_id',
      'approver_role',
      'visibility',
      'exercise_id',
      'progression',
      'progression_step',
      'superset',
    ],
  },
  comments: { insert: ['task_id', 'body'], update: [] },
  task_attachments: {
    insert: ['task_id', 'path', 'thumb_path', 'name', 'mime', 'size', 'width', 'height'],
    update: [],
  },
  task_dependencies: {
    insert: ['task_id', 'depends_on_task_id', 'lag_minutes'],
    update: ['lag_minutes'],
  },
  page_dependencies: {
    insert: ['page_id', 'depends_on_page_id', 'threshold_pct'],
    update: ['threshold_pct'],
  },
  milestones: {
    insert: ['folder_id', 'name', 'due_date', 'done_at', 'position'],
    update: ['name', 'due_date', 'done_at', 'position'],
  },
  task_assignees: { insert: ['task_id', 'user_id', 'pending_name'], update: [] },
  my_day: { insert: ['task_id', 'day', 'position'], update: ['position'] },
  notes: { insert: ['title', 'body', 'folder_id'], update: ['title', 'body'] },
  page_fields: {
    insert: ['page_id', 'name', 'kind', 'options', 'position'],
    update: ['name', 'options', 'position'],
  },
  conflict_copies: { insert: [], update: [] },
  user_exercises: {
    insert: ['folder_id', 'name', 'body_part', 'target', 'equipment', 'kind', 'notes'],
    update: ['name', 'body_part', 'target', 'equipment', 'kind', 'notes'],
  },
  body_metrics: {
    insert: ['kind', 'value', 'measured_on', 'note'],
    update: ['value', 'measured_on', 'note'],
  },
  body_goals: { insert: ['kind', 'target'], update: ['target'] },
  medications: {
    insert: [
      'name',
      'dose',
      'times_per_day',
      'every_days',
      'pack_size',
      'stock',
      'stock_on',
      'paused',
      'notes',
    ],
    update: [
      'name',
      'dose',
      'times_per_day',
      'every_days',
      'pack_size',
      'stock',
      'stock_on',
      'paused',
      'notes',
    ],
  },
  workout_moves: { insert: ['page_id', 'from_day', 'to_day'], update: ['to_day'] },
  expenses: {
    insert: [
      'page_id',
      'spent_on',
      'description',
      'category',
      'amount_cents',
      'currency',
      'kind',
      'paid_by',
      'method',
      'task_id',
      'receipt_path',
      'nfce_key',
      'items',
      'note',
      'split_among',
    ],
    update: [
      'spent_on',
      'description',
      'category',
      'amount_cents',
      'currency',
      'kind',
      'paid_by',
      'method',
      'task_id',
      'receipt_path',
      'nfce_key',
      'items',
      'note',
      'split_among',
    ],
  },
};

// task_progress e timers: o reflexo local do comando (quem grava no servidor é a RPC)
const SERVER_SIDE = new Set([
  'folder_members',
  'task_progress',
  'timers',
  'time_entries',
  'workout_sets',
  'sensitive_consents',
  'page_shares',
  'share_checks',
]);

// No SQLite, jsonb e arrays são texto
const JSON_COLUMNS = new Set([
  'train_days',
  'labels',
  'meta',
  'recurrence',
  'repeat_plan',
  'custom',
  'options',
  'args',
  'items',
  'split_among',
]);

function pick(data: Record<string, unknown>, columns: string[]) {
  const out: Record<string, unknown> = {};
  for (const column of columns) {
    if (!(column in data)) continue;
    const value = data[column];
    out[column] = JSON_COLUMNS.has(column) && typeof value === 'string' ? JSON.parse(value) : value;
  }
  return out;
}

// Erros do Postgres que não somem tentando de novo: dado inválido (22), restrição (23), sem
// permissão (42501) e "não encontrado" das RPCs (P0002). A operação é descartada e o próximo sync
// devolve o estado do servidor.
const FATAL = [/^22...$/, /^23...$/, /^42501$/, /^P0002$/];
const isFatal = (code?: string) => !!code && FATAL.some((re) => re.test(code));

type PgError = { code?: string; message: string };

// Resposta das RPCs da fila (XP, boss, recompensa), para quem fez a ação mostrar o resultado
const waiting = new Map<string, (result: unknown) => void>();
function commandDone(id: string, result: unknown) {
  waiting.get(id)?.(result);
  waiting.delete(id);
  pendingXp.resolve(id);
  onCommandApplied?.();
}

let onCommandApplied: (() => void) | null = null;
let onRejected: ((message: string) => void) | null = null;
/** Chamado quando o servidor recusa uma mudança do aparelho (ela é descartada). */
export function setOnRejected(fn: ((message: string) => void) | null) {
  onRejected = fn;
}
/** Chamado depois de cada comando aplicado no servidor (o app relê XP e boss). */
export function setOnCommandApplied(fn: () => void) {
  onCommandApplied = fn;
}

/** Espera a resposta do comando `id` por até `ms`; sem resposta (offline, lento), null. */
export function commandResult(id: string, ms: number): Promise<unknown> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiting.delete(id);
      resolve(null);
    }, ms);
    waiting.set(id, (result) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

const parseList = (value: unknown): string[] =>
  Array.isArray(value) ? value : typeof value === 'string' ? JSON.parse(value) : [];

// Notas e etiquetas não vão como update comum: notas levam a versão em que o aparelho se baseou
// (o servidor guarda a que perder) e etiquetas vão como "entrou/saiu" (conjunto). Tira as duas do
// `patch` depois de enviar.
async function patchTaskSets(op: CrudEntry, patch: Record<string, unknown>) {
  const before = op.previousValues ?? {};
  if ('notes' in patch) {
    const { error } = await supabase.rpc('set_task_notes', {
      p_task_id: op.id,
      p_notes: (patch.notes as string | null) ?? '',
      // Sem nota antes: null (o tipo gerado não sabe que o parâmetro aceita null)
      p_base: (before.notes ?? null) as string,
    });
    if (error) return error;
    delete patch.notes;
  }
  if ('labels' in patch) {
    const now = parseList(patch.labels);
    const was = parseList(before.labels);
    const { error } = await supabase.rpc('patch_task_labels', {
      p_task_id: op.id,
      p_add: now.filter((l) => !was.includes(l)),
      p_remove: was.filter((l) => !now.includes(l)),
    });
    if (error) return error;
    delete patch.labels;
  }
  return null;
}

async function apply(op: CrudEntry): Promise<PgError | null> {
  const data = op.opData ?? {};

  if (op.table === 'commands') {
    const { data: result, error } = await supabase.rpc('run_once', {
      p_key: op.id,
      p_name: String(data.name),
      p_args: JSON.parse(String(data.args ?? '{}')) as Json,
    });
    if (!error) commandDone(op.id, result);
    return error;
  }

  // Linha que o servidor cria sozinho (a participação do dono nasce com a pasta): não sobe
  if (SERVER_SIDE.has(op.table)) return null;
  const columns = WRITABLE[op.table];
  if (!columns) return { code: '22023', message: `Tabela sem envio: ${op.table}` };
  // Tipos do supabase-js por tabela não ajudam aqui: as colunas já vêm filtradas pelos grants
  const table = supabase.from(op.table as 'tasks');

  if (op.op === UpdateType.PUT) {
    const row = pick(data, columns.insert);
    // Tarefa de primeiro nível nasce pela RPC (posição, responsáveis, XP de quem já cria concluída)
    if (op.table === 'tasks' && !row.parent_task_id) {
      const { page_id, notes, ...item } = row;
      const { error } = await supabase.rpc('create_tasks_batch', {
        p_page_id: String(page_id),
        p_items: [{ id: op.id, ...item }] as Json,
      });
      // O create_tasks_batch não recebe notas
      if (error || !notes) return error;
      const { error: notesError } = await table.update({ notes } as never).eq('id', op.id);
      return notesError;
    }
    const { error } = await table.insert({ id: op.id, ...row } as never);
    return error;
  }

  if (op.op === UpdateType.PATCH) {
    const patch = pick(data, columns.update);
    if (op.table === 'tasks') {
      const error = await patchTaskSets(op, patch);
      if (error) return error;
    }
    if (Object.keys(patch).length === 0) return null;
    const { error } = await table.update(patch as never).eq('id', op.id);
    return error;
  }

  const { error } = await table.delete().eq('id', op.id);
  return error;
}

const isNewTask = (op: CrudEntry) =>
  op.table === 'tasks' && op.op === UpdateType.PUT && !op.opData?.parent_task_id;

/** Tarefas novas seguidas da mesma página vão juntas (um create_tasks_batch em vez de 500). */
function batches(crud: CrudEntry[]) {
  const groups: CrudEntry[][] = [];
  for (const op of crud) {
    const last = groups.at(-1);
    if (
      last &&
      last.length < 500 &&
      isNewTask(op) &&
      isNewTask(last[0]) &&
      last[0].opData?.page_id === op.opData?.page_id &&
      !op.opData?.notes &&
      !last[0].opData?.notes
    )
      last.push(op);
    else groups.push([op]);
  }
  return groups;
}

async function createBatch(ops: CrudEntry[]) {
  const { error } = await supabase.rpc('create_tasks_batch', {
    p_page_id: String(ops[0].opData?.page_id),
    p_items: ops.map((op) => {
      const { page_id: _page, ...item } = pick(op.opData ?? {}, WRITABLE.tasks.insert);
      return { id: op.id, ...item };
    }) as Json,
  });
  return error;
}

export const connector: PowerSyncBackendConnector = {
  async fetchCredentials() {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session || !POWERSYNC_URL) return null;
    return {
      endpoint: POWERSYNC_URL,
      token: data.session.access_token,
      expiresAt: data.session.expires_at ? new Date(data.session.expires_at * 1000) : undefined,
    };
  },

  async uploadData(db: AbstractPowerSyncDatabase) {
    const transaction = await db.getNextCrudTransaction();
    if (!transaction) return;
    // A mudança local que acompanha um comando (concluir marca a linha, o hábito soma) é só o
    // reflexo dele no aparelho: quem muda a linha no servidor é a RPC
    const commanded = new Set(
      transaction.crud
        .filter((op) => op.table === 'commands')
        .map((op) => JSON.parse(String(op.opData?.args ?? '{}')).p_task_id),
    );
    const crud = transaction.crud.filter(
      (op) => !(op.table === 'tasks' && op.op === UpdateType.PATCH && commanded.has(op.id)),
    );
    for (const group of batches(crud)) {
      const op = group[0];
      const error = group.length > 1 ? await createBatch(group) : await apply(op);
      if (!error) continue;
      // Reenvio de algo que já entrou (id repetido): o servidor já tem, segue
      if (error.code === '23505' && op.op === UpdateType.PUT) continue;
      // Sem conexão ou erro passageiro: lança e o SDK tenta de novo mais tarde, na mesma ordem
      if (!isFatal(error.code)) throw new Error(error.message);
      console.warn('[sync] recusado pelo servidor, descartado:', op.table, op.op, error.message);
      // Quem fez a mudança precisa saber: a tela volta ao que o servidor tem
      onRejected?.(error.message);
    }
    await transaction.complete();
  },
};
