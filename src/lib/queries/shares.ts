import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Tables } from '../db';
import { todayIn } from '../parser/dates';
import { cycleKeyFor, taskCycleKind, withMyChecks } from '../share';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import type { Json } from '../database.types';
import { isLocal, runCommand, sessionUserId, toPage } from '../sync/local';
import { uuidv7 } from '../uuid';

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

// ---------- Quem envia ----------

export type ShareRow = PageShare & { recipient_name: string | null };
export type ShareLink = Tables<'page_share_links'>;
const sharesKey = (pageId: string) => ['page-shares', pageId] as const;

/** Envios e links de uma página (quem gerencia). Precisa de conexão. */
export function usePageShares(pageId: string | undefined) {
  return useQuery({
    queryKey: sharesKey(pageId ?? ''),
    enabled: !!pageId,
    queryFn: async () => {
      const [shares, links] = await Promise.all([
        supabase
          .from('page_shares')
          .select('*, recipient:profiles!page_shares_recipient_id_fkey(display_name)')
          .eq('page_id', pageId ?? '')
          .in('status', ['pending', 'active'])
          .order('created_at'),
        supabase
          .from('page_share_links')
          .select('*')
          .eq('page_id', pageId ?? '')
          .is('revoked_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false }),
      ]);
      if (shares.error) throw shares.error;
      if (links.error) throw links.error;
      return {
        shares: shares.data.map(({ recipient, ...s }) => ({
          ...s,
          recipient_name: (recipient as { display_name: string } | null)?.display_name ?? null,
        })) as ShareRow[],
        links: links.data,
      };
    },
  });
}

export function useShareMutations(pageId: string) {
  const queryClient = useQueryClient();
  const settle = () => queryClient.invalidateQueries({ queryKey: sharesKey(pageId) });
  return {
    createLink: useMutation({
      mutationFn: async (mode: 'live' | 'copy') => {
        const { data, error } = await supabase.rpc('create_share_link', {
          p_page_id: pageId,
          p_mode: mode,
        });
        if (error) throw error;
        return data;
      },
      onSettled: settle,
    }),
    byEmail: useMutation({
      mutationFn: async ({ emails, mode }: { emails: string[]; mode: 'live' | 'copy' }) => {
        const { data, error } = await supabase.rpc('share_page_by_email', {
          p_page_id: pageId,
          p_emails: emails,
          p_mode: mode,
        });
        if (error) throw error;
        return data;
      },
      onSettled: settle,
    }),
    revoke: useMutation({
      mutationFn: async (shareId: string) => {
        const { error } = await supabase.rpc('revoke_page_share', { p_share_id: shareId });
        if (error) throw error;
      },
      onSettled: settle,
    }),
    revokeLink: useMutation({
      mutationFn: async (linkId: string) => {
        const { error } = await supabase.rpc('revoke_share_link', { p_link_id: linkId });
        if (error) throw error;
      },
      onSettled: settle,
    }),
  };
}

// ---------- Quem recebe ----------

export type SharePreview =
  | { valid: false; reason: string }
  | {
      valid: true;
      page_name: string;
      page_icon: string | null;
      view_type: string;
      mode: 'live' | 'copy';
      items: number;
      owner_name: string | null;
      own: boolean;
      opened_page_id: string | null;
    };

export function useSharePreview(token: string, loggedIn: boolean) {
  return useQuery({
    queryKey: ['share-preview', token, loggedIn],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('page_share_preview', { p_token: token });
      if (error) throw error;
      return data as unknown as SharePreview;
    },
  });
}

/** Convites pendentes para mim (inclusive os mandados para o meu e-mail antes de eu ter conta). */
export function usePendingShares() {
  return useQuery({
    queryKey: ['pending-shares'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_pending_shares');
      if (error) throw error;
      return data;
    },
  });
}

export function useAcceptShare() {
  const queryClient = useQueryClient();
  const settle = () => {
    for (const key of [receivedKey, ['pending-shares'], ['tree'], ['tasks']])
      queryClient.invalidateQueries({ queryKey: key });
  };
  return {
    byLink: useMutation({
      mutationFn: async ({ token, folderName }: { token: string; folderName: string }) => {
        const { data, error } = await supabase.rpc('accept_page_share_link', {
          p_token: token,
          p_folder_name: folderName,
        });
        if (error) throw error;
        return data as { page_id: string; mode: 'live' | 'copy' };
      },
      onSettled: settle,
    }),
    pending: useMutation({
      mutationFn: async ({ shareId, folderName }: { shareId: string; folderName: string }) => {
        const { data, error } = await supabase.rpc('accept_page_share', {
          p_share_id: shareId,
          p_folder_name: folderName,
        });
        if (error) throw error;
        return data as { page_id: string; mode: 'live' | 'copy' };
      },
      onSettled: settle,
    }),
    decline: useMutation({
      mutationFn: async (shareId: string) => {
        const { error } = await supabase.rpc('decline_page_share', { p_share_id: shareId });
        if (error) throw error;
      },
      onSettled: settle,
    }),
  };
}

/** Endereço do link de envio (na web, o atual; no app, EXPO_PUBLIC_WEB_URL). */
export function shareUrl(token: string) {
  const base =
    process.env.EXPO_PUBLIC_WEB_URL ||
    (typeof window !== 'undefined' && window.location?.origin) ||
    'http://localhost:8082';
  return `${base.replace(/\/$/, '')}/enviada/${encodeURIComponent(token)}`;
}

// ---------- Painel "Alunos" (L5) ----------

export type Student = {
  share_id: string;
  recipient_id: string;
  name: string | null;
  mode: string;
  accepted_at: string | null;
  last_activity: string | null;
  done_now: number;
  items: number;
  sessions: number;
  expected: number | null;
  notes_recent: number;
  last_reminded_at: string | null;
};

export function usePageStudents(pageId: string | undefined) {
  return useQuery({
    queryKey: ['students', pageId ?? ''],
    enabled: !!pageId,
    queryFn: async (): Promise<Student[]> => {
      const { data, error } = await supabase.rpc('page_students', { p_page_id: pageId ?? '' });
      if (error) throw error;
      return data;
    },
  });
}

export type StudentCheck = {
  id: string;
  task_id: string;
  cycle_key: string;
  done_at: string;
  note: string | null;
  values: { weight?: string | null; reps?: number | null }[] | null;
  title: string;
};

/** Histórico do aluno na página: cada conclusão (com as séries) e observação. */
export function useStudentHistory(pageId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['student-history', pageId ?? '', userId ?? ''],
    enabled: !!pageId && !!userId,
    queryFn: async (): Promise<StudentCheck[]> => {
      const { data, error } = await supabase
        .from('share_checks')
        .select('id, task_id, cycle_key, done_at, note, values, task:tasks(title)')
        .eq('page_id', pageId ?? '')
        .eq('user_id', userId ?? '')
        .order('done_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return data.map(({ task, ...c }) => ({
        ...c,
        values: (c.values as StudentCheck['values']) ?? null,
        title: (task as { title: string } | null)?.title ?? '—',
      }));
    },
  });
}

export function useStudentActions(pageId: string) {
  const queryClient = useQueryClient();
  const settle = () => {
    queryClient.invalidateQueries({ queryKey: ['students', pageId] });
    queryClient.invalidateQueries({ queryKey: sharesKey(pageId) });
  };
  return {
    remind: useMutation({
      mutationFn: async (shareId: string) => {
        const { error } = await supabase.rpc('remind_student', { p_share_id: shareId });
        if (error) throw error;
      },
      onSettled: settle,
    }),
    archive: useMutation({
      mutationFn: async (shareId: string) => {
        const { error } = await supabase.rpc('archive_page_share', { p_share_id: shareId });
        if (error) throw error;
      },
      onSettled: settle,
    }),
  };
}

/** Aluno: marca o item com uma observação para o autor (L5). Também offline. */
export function useNoteForSender() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async ({
      taskId,
      pageId,
      recurrence,
      note,
    }: {
      taskId: string;
      pageId: string;
      recurrence: unknown;
      note: string;
    }) => {
      const args = { p_task_id: taskId, p_done: true, p_note: note };
      if (!isLocal()) {
        const { error } = await supabase.rpc('run_once', {
          p_key: uuidv7(),
          p_name: 'check_item',
          p_args: args as Json,
        });
        if (error) throw error;
        return;
      }
      const userId = await sessionUserId();
      const key = await localCycleKey(pageId, recurrence);
      await runCommand('check_item', args, async (tx) => {
        await tx.execute(
          'delete from share_checks where task_id = ? and user_id = ? and cycle_key = ?',
          [taskId, userId, key],
        );
        await tx.execute(
          `insert into share_checks (id, task_id, page_id, user_id, cycle_key, done_at, note)
           values (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv7(), taskId, pageId, userId, key, new Date().toISOString(), note],
        );
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

/** A observação que deixei neste item, no ciclo atual. */
export function useMyNote(taskId: string, pageId: string, recurrence: unknown) {
  return useQuery({
    queryKey: ['tasks', 'my-note', taskId],
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async () => {
      const userId = await sessionUserId();
      if (isLocal()) {
        const key = await localCycleKey(pageId, recurrence);
        const row = await db.getOptional<{ note: string | null }>(
          'select note from share_checks where task_id = ? and user_id = ? and cycle_key = ?',
          [taskId, userId, key],
        );
        return row?.note ?? null;
      }
      const { data } = await supabase
        .from('share_checks')
        .select('note, done_at')
        .eq('task_id', taskId)
        .eq('user_id', userId ?? '')
        .order('done_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.note ?? null;
    },
  });
}
