import { useQuery } from '@tanstack/react-query';

import type { Tables } from '../db';
import { todayIn } from '../parser/dates';
import { cycleKeyFor, taskCycleKind, withMyChecks } from '../share';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, sessionUserId, toPage } from '../sync/local';

// Páginas enviadas (L, D133). Do lado de quem recebe: as páginas ao vivo que chegaram (com o
// envio) e os convites pendentes. A página recebida não está na árvore de pastas do usuário.

export type PageShare = Tables<'page_shares'>;
export type ReceivedPage = Tables<'pages'> & {
  share_id: string;
  owner_id: string;
  owner_name: string | null;
};

export const receivedKey = ['received'] as const;

export function useReceivedPages() {
  return useQuery({
    queryKey: receivedKey,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<ReceivedPage[]> => {
      const userId = await sessionUserId();
      if (!userId) return [];
      if (isLocal()) {
        const rows = await db.getAll<Record<string, unknown>>(
          `select p.*, s.id as share_id, s.owner_id as owner_id, pe.display_name as owner_name
           from page_shares s join pages p on p.id = s.page_id
           left join people pe on pe.id = s.owner_id
           where s.recipient_id = ? and s.status = 'active' and s.mode = 'live'
           order by p.name`,
          [userId],
        );
        return rows.map((row) => {
          const { share_id, owner_id, owner_name, ...page } = row;
          return {
            ...toPage(page),
            share_id: share_id as string,
            owner_id: owner_id as string,
            owner_name: (owner_name as string | null) ?? null,
          };
        });
      }
      const { data, error } = await supabase
        .from('page_shares')
        .select('id, owner_id, page:pages!page_shares_page_id_fkey(*)')
        .eq('recipient_id', userId)
        .eq('status', 'active')
        .eq('mode', 'live');
      if (error) throw error;
      return data
        .filter((s) => s.page)
        .map((s) => ({
          ...(s.page as Tables<'pages'>),
          share_id: s.id,
          owner_id: s.owner_id,
          owner_name: null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

/** A página (ou a pasta dela) chegou para mim por envio, e não é minha? */
export function useIsReceived(pageOrFolderId: string | null | undefined) {
  const received = useReceivedPages();
  return (
    !!pageOrFolderId &&
    !!received.data?.some((p) => p.id === pageOrFolderId || p.folder_id === pageOrFolderId)
  );
}

type Overlayable = {
  id: string;
  page_id: string;
  status: string;
  completed_at: string | null;
  recurrence: unknown;
};

/**
 * Página recebida ao vivo: troca o estado das tarefas pelo "feito" do aluno no ciclo atual (L2,
 * D134). Página que não é recebida volta como veio.
 */
export async function overlayReceived<T extends Overlayable>(
  tasks: T[],
  pageId: string,
): Promise<T[]> {
  if (tasks.length === 0) return tasks;
  const userId = await sessionUserId();
  if (!userId) return tasks;
  let page: { view_type: string; reset_cycle: string; manual_cycle: number } | null;
  let timeZone: string | null;
  let checks: { task_id: string; cycle_key: string; done_at: string }[];
  if (isLocal()) {
    const shared = await db.getOptional(
      `select 1 as ok from page_shares
       where page_id = ? and recipient_id = ? and status = 'active' and mode = 'live'`,
      [pageId, userId],
    );
    if (!shared) return tasks;
    page = await db.getOptional(
      'select view_type, reset_cycle, manual_cycle from pages where id = ?',
      [pageId],
    );
    timeZone =
      (
        await db.getOptional<{ timezone: string }>('select timezone from profiles where id = ?', [
          userId,
        ])
      )?.timezone ?? null;
    checks = await db.getAll(
      'select task_id, cycle_key, done_at from share_checks where page_id = ? and user_id = ?',
      [pageId, userId],
    );
  } else {
    const { data: share } = await supabase
      .from('page_shares')
      .select('id')
      .eq('page_id', pageId)
      .eq('recipient_id', userId)
      .eq('status', 'active')
      .eq('mode', 'live')
      .maybeSingle();
    if (!share) return tasks;
    const [p, profile, rows] = await Promise.all([
      supabase
        .from('pages')
        .select('view_type, reset_cycle, manual_cycle')
        .eq('id', pageId)
        .maybeSingle(),
      supabase.from('profiles').select('timezone').eq('id', userId).maybeSingle(),
      supabase
        .from('share_checks')
        .select('task_id, cycle_key, done_at')
        .eq('page_id', pageId)
        .eq('user_id', userId),
    ]);
    page = p.data;
    timeZone = profile.data?.timezone ?? null;
    checks = rows.data ?? [];
  }
  if (!page) return tasks;
  const today = todayIn(timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const mine = new Map<string, string>();
  for (const task of tasks) {
    const key = cycleKeyFor(
      taskCycleKind(page.view_type, page.reset_cycle, task.recurrence),
      today,
      page.manual_cycle,
    );
    const check = checks.find((c) => c.task_id === task.id && c.cycle_key === key);
    if (check) mine.set(task.id, check.done_at.replace(' ', 'T'));
  }
  return withMyChecks(tasks, mine);
}

/** A tarefa é de uma página que recebi ao vivo? (para marcar pelo check_item) */
export async function isReceivedTask(taskId: string): Promise<{ pageId: string } | null> {
  const userId = await sessionUserId();
  if (!userId) return null;
  if (isLocal()) {
    const row = await db.getOptional<{ page_id: string }>(
      `select t.page_id from tasks t join page_shares s on s.page_id = t.page_id
       where t.id = ? and s.recipient_id = ? and s.status = 'active' and s.mode = 'live'`,
      [taskId, userId],
    );
    return row ? { pageId: row.page_id } : null;
  }
  const { data: task } = await supabase
    .from('tasks')
    .select('page_id, folder_id')
    .eq('id', taskId)
    .maybeSingle();
  if (!task) return null;
  const { data: share } = await supabase
    .from('page_shares')
    .select('id')
    .eq('page_id', task.page_id)
    .eq('recipient_id', userId)
    .eq('status', 'active')
    .eq('mode', 'live')
    .maybeSingle();
  return share ? { pageId: task.page_id } : null;
}

/** Chave do ciclo atual da página (para o reflexo local da marcação). */
export async function localCycleKey(pageId: string, recurrence: unknown) {
  const userId = await sessionUserId();
  const page = await db.getOptional<{
    view_type: string;
    reset_cycle: string;
    manual_cycle: number;
  }>('select view_type, reset_cycle, manual_cycle from pages where id = ?', [pageId]);
  const tz = (
    await db.getOptional<{ timezone: string }>('select timezone from profiles where id = ?', [
      userId,
    ])
  )?.timezone;
  if (!page) return 'once';
  return cycleKeyFor(
    taskCycleKind(page.view_type, page.reset_cycle, recurrence),
    todayIn(tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone),
    page.manual_cycle,
  );
}
