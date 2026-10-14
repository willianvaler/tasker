import {
  UpdateType,
  type AbstractPowerSyncDatabase,
  type CrudEntry,
  type PowerSyncBackendConnector,
} from '@powersync/common';

import type { Json } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

// Sem a variável, o app não sincroniza (o banco local fica vazio e as telas usam o Supabase)
const envUrl = process.env.EXPO_PUBLIC_POWERSYNC_URL;
export const POWERSYNC_URL = envUrl?.startsWith('/')
  ? `${globalThis.location?.origin ?? ''}${envUrl}`
  : (envUrl ?? null);

// O que o cliente pode gravar em cada tabela (os mesmos grants do banco). O resto do que muda no
// aparelho (status, contagens, XP) é efeito de uma RPC da tabela `commands` e volta pelo sync.
const WRITABLE: Record<string, { insert: string[]; update: string[] }> = {
  folders: {
    insert: ['name', 'parent_id', 'icon', 'color', 'position', 'kind'],
    update: ['name', 'icon', 'color', 'position', 'archived', 'kind'],
  },
  pages: {
    insert: ['folder_id', 'name', 'icon', 'view_type', 'reset_cycle', 'position'],
    update: ['folder_id', 'name', 'icon', 'view_type', 'reset_cycle', 'position'],
  },
  tasks: {
    insert: [
      'page_id',
      'parent_task_id',
      'title',
      'notes',
      'priority',
      'due_date',
      'labels',
      'meta',
      'recurrence',
      'position',
      'habit_kind',
      'habit_target',
    ],
    update: [
      'page_id',
      'parent_task_id',
      'title',
      'notes',
      'priority',
      'due_date',
      'labels',
      'meta',
      'recurrence',
      'position',
      'habit_kind',
      'habit_target',
    ],
  },
  comments: { insert: ['task_id', 'body'], update: [] },
  task_assignees: { insert: ['task_id', 'user_id', 'pending_name'], update: [] },
  conflict_copies: { insert: [], update: [] },
};

// No SQLite, jsonb e arrays são texto
const JSON_COLUMNS = new Set(['labels', 'meta', 'recurrence', 'args']);

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
    const { error } = await supabase.rpc('run_once', {
      p_key: op.id,
      p_name: String(data.name),
      p_args: JSON.parse(String(data.args ?? '{}')) as Json,
    });
    return error;
  }

  const columns = WRITABLE[op.table];
  if (!columns) return { message: `Tabela sem envio: ${op.table}` };
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
    for (const op of transaction.crud) {
      const error = await apply(op);
      if (!error) continue;
      // Reenvio de algo que já entrou (id repetido): o servidor já tem, segue
      if (error.code === '23505' && op.op === UpdateType.PUT) continue;
      // Sem conexão ou erro passageiro: lança e o SDK tenta de novo mais tarde, na mesma ordem
      if (!isFatal(error.code)) throw new Error(error.message);
      console.warn('[sync] recusado pelo servidor, descartado:', op.table, op.op, error.message);
    }
    await transaction.complete();
  },
};
