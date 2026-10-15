import type { Transaction } from '@powersync/common';
import { onlineManager } from '@tanstack/react-query';

import type { Tables } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { uuidv7 } from '@/lib/uuid';

import { commandResult, POWERSYNC_URL } from './connector';
import { db } from './db';
import { pendingXp } from './pending-xp';

/**
 * As telas leem e gravam no banco do aparelho depois da primeira sincronização completa; antes
 * disso (ou sem sync configurado), continuam no Supabase.
 */
export const isLocal = () => !!POWERSYNC_URL && !!db.currentStatus?.hasSynced;

type Row = Record<string, unknown>;

// O Postgres manda timestamptz como "2026-10-14 05:32:03.123Z"; o resto do app espera ISO
const iso = (value: unknown) =>
  typeof value === 'string' ? value.replace(' ', 'T') : (value as string | null);
const json = (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : (value ?? null));

export function toTask(row: Row): Tables<'tasks'> {
  return {
    ...(row as Tables<'tasks'>),
    labels: json(row.labels) ?? [],
    recurrence: json(row.recurrence),
    meta: json(row.meta),
    repeat_plan: json(row.repeat_plan),
    custom: json(row.custom) ?? {},
    created_at: iso(row.created_at)!,
    updated_at: iso(row.updated_at)!,
    completed_at: iso(row.completed_at),
  };
}

export function toPage(row: Row): Tables<'pages'> {
  return {
    ...(row as Tables<'pages'>),
    is_inbox: !!row.is_inbox,
    is_habits: !!row.is_habits,
    created_at: iso(row.created_at)!,
    updated_at: iso(row.updated_at)!,
  };
}

export function toFolder(row: Row): Tables<'folders'> {
  return {
    ...(row as Tables<'folders'>),
    is_shared: !!row.is_shared,
    is_inbox: !!row.is_inbox,
    archived: !!row.archived,
    // Linha que chegou antes da coluna existir: vale o padrão do banco (ligado)
    auto_complete_parent: row.auto_complete_parent == null ? true : !!row.auto_complete_parent,
    created_at: iso(row.created_at)!,
    updated_at: iso(row.updated_at)!,
  };
}

/** Tarefa com o nome, ícone e tipo da página (Hoje, Início, hábitos). */
export function toTaskWithPage(row: Row) {
  const { page_name, page_icon, page_view_type, ...task } = row;
  return {
    ...toTask(task),
    page:
      page_name == null
        ? null
        : {
            name: page_name as string,
            icon: (page_icon as string | null) ?? null,
            view_type: page_view_type as string,
          },
  };
}

// Só tarefas das minhas pastas: as de uma página recebida (L) vêm sem a pasta do autor e ficam
// fora das listas gerais (Hoje, Início); aparecem só na página delas, com o progresso do aluno
export const TASK_WITH_PAGE_SQL = `select t.*, p.name as page_name, p.icon as page_icon,
  p.view_type as page_view_type from tasks t left join pages p on p.id = t.page_id
  join folders own_folder on own_folder.id = t.folder_id`;

export async function localTasks(sql: string, params: unknown[] = []) {
  return (await db.getAll<Row>(sql, params)).map(toTask);
}

const lastRefresh = new Map<string, number>();

/**
 * O servidor reabre o que venceu de ciclo; o resultado chega pelo sync. Sem esperar, e no máximo
 * uma vez por minuto por página: toda releitura local passa por aqui, e cada chamada que muda
 * alguma linha volta pelo sync como outra releitura.
 */
export function refreshCyclesInBackground(pageId?: string) {
  const key = pageId ?? '*';
  const now = Date.now();
  if (now - (lastRefresh.get(key) ?? 0) < 60_000) return;
  lastRefresh.set(key, now);
  supabase.rpc('refresh_cycles', pageId ? { p_page_id: pageId } : {}).then(undefined, () => {});
}

/**
 * Grava um comando (ação que vira RPC no servidor) e, se há conexão, espera a resposta por pouco
 * tempo para mostrar o resultado (XP, dano). Sem conexão, segue sem resposta: o comando fica na
 * fila e o resultado oficial chega quando sincronizar.
 */
export async function runCommand(
  name: string,
  args: Record<string, unknown>,
  localChange?: (tx: Transaction) => Promise<unknown>,
  /** XP estimado, mostrado como pendente se a resposta não vier logo */
  estimate = 0,
) {
  const id = uuidv7();
  await db.writeTransaction(async (tx) => {
    if (localChange) await localChange(tx);
    await tx.execute('insert into commands (id, name, args) values (?, ?, ?)', [
      id,
      name,
      JSON.stringify(args),
    ]);
  });
  // O PowerSync leva alguns segundos para notar a queda; o navegador avisa na hora
  const online = db.currentStatus.connected && onlineManager.isOnline();
  const result = online ? await commandResult(id, 3000) : null;
  if (result == null) pendingXp.add(id, estimate);
  return result;
}

/** Valor para uma coluna do SQLite: jsonb e arrays viram texto. */
export const toSqlValue = (value: unknown) =>
  value !== null && typeof value === 'object' ? JSON.stringify(value) : value;

/** Colunas de criação das tabelas versionadas (pastas, páginas, tarefas). */
export const newRowStamps = () => {
  const now = new Date().toISOString();
  return { created_at: now, updated_at: now, version: 1 };
};

/** Grava uma linha nova no banco do aparelho. */
export async function localInsert(table: string, row: Record<string, unknown>) {
  const columns = Object.keys(row);
  await db.execute(
    `insert into ${table} (${columns.join(', ')}) values (${columns.map(() => '?').join(', ')})`,
    columns.map((c) => toSqlValue(row[c])),
  );
}

export async function localUpdate(table: string, id: string, patch: Record<string, unknown>) {
  const columns = Object.keys(patch);
  if (columns.length === 0) return;
  await db.execute(
    `update ${table} set ${columns.map((c) => `${c} = ?`).join(', ')} where id = ?`,
    [...columns.map((c) => toSqlValue(patch[c])), id],
  );
}

export const sessionUserId = async () =>
  (await supabase.auth.getSession()).data.session?.user.id ?? null;

let folderCache: { userId: string; at: number; ids: string[] } | null = null;

/**
 * Pastas da pessoa (raízes de que é membro e as subpastas), para as consultas pelo servidor
 * filtrarem `folder_id in (...)`: sem isso a RLS confere todas as tarefas do banco (D70, F4).
 * Cache de 1 minuto em memória.
 */
export async function myFolderIds(): Promise<string[]> {
  const userId = await sessionUserId();
  if (!userId) return [];
  if (folderCache && folderCache.userId === userId && Date.now() - folderCache.at < 60_000)
    return folderCache.ids;
  const roots = await supabase.from('folder_members').select('folder_id').eq('user_id', userId);
  const rootIds = (roots.data ?? []).map((r) => r.folder_id);
  const children = rootIds.length
    ? await supabase.from('folders').select('id').in('parent_id', rootIds)
    : { data: [] as { id: string }[] };
  const ids = [...rootIds, ...(children.data ?? []).map((c) => c.id)];
  folderCache = { userId, at: Date.now(), ids };
  return ids;
}
