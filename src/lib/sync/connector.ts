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

// Erros do Postgres que não somem tentando de novo: dado inválido (22), restrição (23) e permissão
// (42501). A operação é descartada e o próximo sync devolve o estado do servidor.
const FATAL = [/^22...$/, /^23...$/, /^42501$/];
const isFatal = (code?: string) => !!code && FATAL.some((re) => re.test(code));

type PgError = { code?: string; message: string };

async function apply(op: CrudEntry): Promise<PgError | null> {
  const data = op.opData ?? {};
  if (op.table === 'commands') {
    const { error } = await supabase.rpc(
      data.name as never,
      JSON.parse(String(data.args ?? '{}')) as never,
    );
    return error;
  }
  if (op.table === 'tasks' && op.op === UpdateType.PUT) {
    const { error } = await supabase.rpc('create_tasks_batch', {
      p_page_id: String(data.page_id),
      p_items: [
        {
          id: op.id,
          title: data.title,
          priority: data.priority ?? 0,
          due_date: data.due_date ?? null,
          labels: data.labels ? JSON.parse(String(data.labels)) : [],
          recurrence: data.recurrence ? JSON.parse(String(data.recurrence)) : null,
          meta: data.meta ? JSON.parse(String(data.meta)) : null,
          done: false,
          assignees: [],
          children: [],
        },
      ] as Json,
    });
    return error;
  }
  const table = supabase.from(op.table as 'tasks');
  // Concluir e desfazer passam pelas RPCs (XP, ciclo, recorrência); o resto do PATCH é update comum
  if (op.table === 'tasks' && op.op === UpdateType.PATCH && 'status' in data) {
    const { status, ...rest } = data;
    const { error } = await supabase.rpc(status === 'done' ? 'complete_task' : 'uncomplete_task', {
      p_task_id: op.id,
    });
    if (error || Object.keys(rest).length === 0) return error;
    const { error: restError } = await table.update(rest as never).eq('id', op.id);
    return restError;
  }
  if (op.op === UpdateType.PATCH) {
    const { error } = await table.update(data as never).eq('id', op.id);
    return error;
  }
  if (op.op === UpdateType.DELETE) {
    const { error } = await table.delete().eq('id', op.id);
    return error;
  }
  return { message: `Operação sem tradução: ${op.op} em ${op.table}` };
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
      // Sem conexão ou erro passageiro: lança e o SDK tenta de novo mais tarde, na mesma ordem
      if (!isFatal(error.code)) throw new Error(error.message);
      console.warn('[sync] recusado pelo servidor, descartado:', op.table, op.op, error.message);
    }
    await transaction.complete();
  },
};
