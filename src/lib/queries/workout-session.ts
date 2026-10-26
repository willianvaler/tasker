import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Json } from '../db';
import { supabase } from '../supabase';
import { keys } from './keys';

// Treinar junto (V6 §15.4, AC10.1, D183): a sessão do Modo Treino no servidor. Só online; o tempo
// real chega pelo useRealtimeSync (workout_sessions e workout_session_members no AFFECTS).

export type SessionMember = {
  userId: string;
  status: 'invited' | 'joined' | 'left';
  displayName: string;
};
export type SessionState = { task_id?: string; rest_ends_at?: string | null };
export type WorkoutSession = {
  id: string;
  pageId: string;
  startedBy: string;
  startedAt: string;
  endedAt: string | null;
  state: SessionState;
  /** Séries do grupo por tarefa */
  progress: Record<string, number>;
  members: SessionMember[];
};

export type WorkoutInvite = {
  session_id: string;
  page_id: string;
  page_name: string;
  by_name: string | null;
  started_at: string;
};

const sessionKey = (id: string) => ['workout-session', id] as const;
const invitesKey = ['workout-invites'] as const;

function readProgress(progress: Json): Record<string, number> {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return {};
  return Object.fromEntries(
    Object.entries(progress).map(([taskId, entry]) => {
      const reps =
        entry && typeof entry === 'object' && !Array.isArray(entry) ? Number(entry.reps) : 0;
      return [taskId, Number.isFinite(reps) ? reps : 0];
    }),
  );
}

export function useWorkoutSession(id: string | null | undefined) {
  return useQuery({
    queryKey: sessionKey(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<WorkoutSession | null> => {
      const [session, members] = await Promise.all([
        supabase
          .from('workout_sessions')
          .select('*')
          .eq('id', id ?? '')
          .maybeSingle(),
        // Com o nome: quem vem de fora da pasta (AC15A) não está nos membros dela
        supabase.rpc('workout_session_people', { p_session_id: id ?? '' }),
      ]);
      if (session.error) throw session.error;
      if (members.error) throw members.error;
      const s = session.data;
      if (!s) return null;
      return {
        id: s.id,
        pageId: s.page_id,
        startedBy: s.started_by,
        startedAt: s.started_at,
        endedAt: s.ended_at,
        state: (s.state && typeof s.state === 'object' ? s.state : {}) as SessionState,
        progress: readProgress(s.progress),
        members: members.data.map((m) => ({
          userId: m.user_id,
          status: m.status as SessionMember['status'],
          displayName: m.display_name,
        })),
      };
    },
  });
}

export type PartnerSource = 'folder' | 'friend' | 'team' | 'group';
export type WorkoutPartner = { userId: string; displayName: string; source: PartnerSource };

/**
 * Com quem dá para treinar (AC15A): quem é da pasta, amigos e gente dos mesmos times e grupos,
 * nessa ordem.
 */
export function useWorkoutPartners(pageId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['workout-partners', pageId ?? ''] as const,
    enabled: !!pageId && enabled,
    queryFn: async (): Promise<WorkoutPartner[]> => {
      const { data, error } = await supabase.rpc('workout_partners', { p_page_id: pageId ?? '' });
      if (error) throw error;
      return data.map((p) => ({
        userId: p.user_id,
        displayName: p.display_name,
        source: p.source as PartnerSource,
      }));
    },
  });
}

/**
 * Treino de outra pessoa (AC15A): quem foi chamado e não é da pasta lê a página e as tarefas do
 * servidor enquanto está na sessão (não estão no aparelho).
 */
export function useGuestWorkout(pageId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['workout-guest', pageId ?? ''] as const,
    enabled: !!pageId && enabled,
    queryFn: async () => {
      const [page, tasks] = await Promise.all([
        supabase
          .from('pages')
          .select('*')
          .eq('id', pageId ?? '')
          .maybeSingle(),
        supabase
          .from('tasks')
          .select('*')
          .eq('page_id', pageId ?? '')
          .order('position')
          .order('created_at'),
      ]);
      if (page.error) throw page.error;
      if (tasks.error) throw tasks.error;
      return { page: page.data, tasks: tasks.data };
    },
  });
}

/** "Fulano começou o treino com você": convites abertos para mim. */
export function useWorkoutInvites(enabled = true) {
  return useQuery({
    queryKey: invitesKey,
    enabled,
    queryFn: async (): Promise<WorkoutInvite[]> => {
      const { data, error } = await supabase.rpc('my_workout_invites');
      if (error) throw error;
      return data;
    },
  });
}

export function useWorkoutSessionActions() {
  const queryClient = useQueryClient();
  const refresh = (id?: string) => {
    queryClient.invalidateQueries({ queryKey: invitesKey });
    if (id) queryClient.invalidateQueries({ queryKey: sessionKey(id) });
  };

  const start = useMutation({
    mutationFn: async ({ pageId, withUsers }: { pageId: string; withUsers: string[] }) => {
      const { data, error } = await supabase.rpc('start_workout_session', {
        p_page_id: pageId,
        p_with: withUsers,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (id) => refresh(id),
  });

  /** Chamar gente no meio do treino (AC15A) */
  const invite = useMutation({
    mutationFn: async ({ id, withUsers }: { id: string; withUsers: string[] }) => {
      const { error } = await supabase.rpc('invite_to_workout_session', {
        p_session_id: id,
        p_with: withUsers,
      });
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => refresh(id),
  });

  const join = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('join_workout_session', { p_session_id: id });
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => refresh(id),
  });

  const leave = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('leave_workout_session', { p_session_id: id });
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => refresh(id),
  });

  const setState = useMutation({
    mutationFn: async ({ id, state }: { id: string; state: SessionState }) => {
      const { error } = await supabase.rpc('set_workout_state', {
        p_session_id: id,
        p_state: state as Json,
      });
      if (error) throw error;
    },
    onMutate: ({ id, state }) => {
      const key = sessionKey(id);
      const previous = queryClient.getQueryData<WorkoutSession | null>(key);
      if (previous)
        queryClient.setQueryData(key, { ...previous, state: { ...previous.state, ...state } });
    },
  });

  /** Série do grupo; a contagem muda na tela antes da resposta. */
  const logGroupSet = useMutation({
    mutationFn: async (vars: {
      id: string;
      taskId: string;
      delta: 1 | -1;
      values?: Record<string, unknown> | null;
    }) => {
      const { data, error } = await supabase.rpc('log_group_set', {
        p_session_id: vars.id,
        p_task_id: vars.taskId,
        p_delta: vars.delta,
        p_values: (vars.values ?? null) as Json,
      });
      if (error) throw error;
      return data as { done_reps: number; total: number; completed: boolean; xp?: number };
    },
    onMutate: ({ id, taskId, delta }) => {
      const key = sessionKey(id);
      const previous = queryClient.getQueryData<WorkoutSession | null>(key);
      if (previous) {
        const reps = Math.max(0, (previous.progress[taskId] ?? 0) + delta);
        queryClient.setQueryData(key, {
          ...previous,
          progress: { ...previous.progress, [taskId]: reps },
        });
      }
      return { previous };
    },
    onError: (_e, { id }, context) => {
      if (context?.previous) queryClient.setQueryData(sessionKey(id), context.previous);
    },
    onSettled: (_d, _e, { id }) => {
      queryClient.invalidateQueries({ queryKey: sessionKey(id) });
      queryClient.invalidateQueries({ queryKey: keys.tasks });
      queryClient.invalidateQueries({ queryKey: ['workout-guest'] });
      queryClient.invalidateQueries({ queryKey: keys.game });
    },
  });

  return { start, invite, join, leave, setState, logGroupSet };
}
