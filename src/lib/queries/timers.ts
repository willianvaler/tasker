import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Json } from '../database.types';
import { getDeviceId } from '../prefs';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, runCommand, sessionUserId } from '../sync/local';
import { applyTimerAction, type Timer, type TimerAction, type TimerKind } from '../timers';
import { uuidv7 } from '../uuid';
import { keys } from './keys';

// Timer ativo (J2, D124): um por pessoa, sincronizado entre os aparelhos. Só as RPCs start_timer
// e update_timer mudam; offline, vão pela fila (runCommand) com o horário do aparelho.

const ACTIVE = `state in ('running', 'paused')`;

function toTimer(row: Record<string, unknown>): Timer {
  const iso = (v: unknown) => (typeof v === 'string' ? v.replace(' ', 'T') : null);
  return {
    ...(row as Timer),
    config: typeof row.config === 'string' ? JSON.parse(row.config) : ((row.config as Json) ?? {}),
    started_at: iso(row.started_at)!,
    ends_at: iso(row.ends_at),
    ended_at: iso(row.ended_at),
    updated_at: iso(row.updated_at)!,
  };
}

export function useActiveTimer() {
  return useQuery({
    queryKey: keys.timer,
    networkMode: isLocal() ? 'always' : 'online',
    // Sem o sync, o timer iniciado em outro aparelho chega por aqui
    refetchInterval: isLocal() ? false : 30_000,
    queryFn: async (): Promise<Timer | null> => {
      const userId = await sessionUserId();
      if (!userId) return null;
      if (isLocal()) {
        const row = await db.getOptional<Record<string, unknown>>(
          `select * from timers where user_id = ? and ${ACTIVE} order by started_at desc limit 1`,
          [userId],
        );
        return row ? toTimer(row) : null;
      }
      const { data, error } = await supabase
        .from('timers')
        .select('*')
        .eq('user_id', userId)
        .in('state', ['running', 'paused'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export type StartTimerVars = {
  kind: TimerKind;
  /** Duração (não vale para o cronômetro) */
  seconds?: number;
  taskId?: string | null;
  /** Rótulo e o que fazer ao fim, ex.: { label: 'Supino reto, 3/4' } */
  config?: Record<string, unknown>;
};

/** Manda uma ação de timer: pela fila do aparelho (offline) ou direto pelo run_once. */
async function send(name: string, args: Record<string, unknown>, local: (tx: Tx) => Promise<void>) {
  if (isLocal()) {
    await runCommand(name, args, local);
    return;
  }
  // run_once também online: o reenvio da fila do TanStack não repete a ação
  const { error } = await supabase.rpc('run_once', {
    p_key: uuidv7(),
    p_name: name,
    p_args: args as Json,
  });
  if (error) throw error;
}

type Tx = Parameters<NonNullable<Parameters<typeof runCommand>[2]>>[0];

const LOCAL_COLUMNS = [
  'state',
  'started_at',
  'ends_at',
  'paused_seconds',
  'ended_at',
  'updated_at',
] as const;

export function useTimerActions() {
  const queryClient = useQueryClient();
  const settle = () => queryClient.invalidateQueries({ queryKey: keys.timer });
  const networkMode = isLocal() ? ('always' as const) : ('online' as const);

  const start = useMutation({
    networkMode,
    mutationFn: async (vars: StartTimerVars & { id: string; startedAt: string }) => {
      const userId = await sessionUserId();
      const args = {
        p_id: vars.id,
        p_kind: vars.kind,
        p_started_at: vars.startedAt,
        p_seconds: vars.kind === 'stopwatch' ? null : (vars.seconds ?? 0),
        p_task_id: vars.taskId ?? null,
        p_config: vars.config ?? {},
        p_device: getDeviceId(),
      };
      await send('start_timer', args, async (tx) => {
        // Espelho do start_timer: o ativo de antes termina, este começa
        await tx.execute(
          `update timers set state = 'cancelled', ended_at = ?, updated_at = ? where user_id = ? and ${ACTIVE}`,
          [vars.startedAt, vars.startedAt, userId],
        );
        await tx.execute(
          `insert into timers (id, user_id, task_id, kind, state, started_at, ends_at, device_id, config, updated_at,
           duration_seconds) values (?, ?, ?, ?, 'running', ?, ?, ?, ?, ?, ?)`,
          [
            vars.id,
            userId,
            vars.taskId ?? null,
            vars.kind,
            vars.startedAt,
            vars.kind === 'stopwatch'
              ? null
              : new Date(Date.parse(vars.startedAt) + (vars.seconds ?? 0) * 1000).toISOString(),
            getDeviceId(),
            JSON.stringify(vars.config ?? {}),
            vars.startedAt,
            vars.kind === 'stopwatch' ? null : (vars.seconds ?? null),
          ],
        );
      });
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: keys.timer });
      const before = queryClient.getQueryData<Timer | null>(keys.timer);
      const optimistic: Timer = {
        id: vars.id,
        user_id: before?.user_id ?? '',
        task_id: vars.taskId ?? null,
        kind: vars.kind,
        state: 'running',
        started_at: vars.startedAt,
        ends_at:
          vars.kind === 'stopwatch'
            ? null
            : new Date(Date.parse(vars.startedAt) + (vars.seconds ?? 0) * 1000).toISOString(),
        paused_seconds: null,
        duration_seconds: vars.kind === 'stopwatch' ? null : (vars.seconds ?? null),
        ended_at: null,
        device_id: getDeviceId(),
        config: (vars.config ?? {}) as NonNullable<Json>,
        updated_at: vars.startedAt,
      };
      queryClient.setQueryData(keys.timer, optimistic);
      return { before };
    },
    onError: (_err, _vars, context) => queryClient.setQueryData(keys.timer, context?.before),
    onSettled: settle,
  });

  const act = useMutation({
    networkMode,
    mutationFn: async ({
      timer,
      action,
      seconds = 0,
      at,
    }: {
      timer: Timer;
      action: TimerAction;
      seconds?: number;
      at: string;
    }) => {
      const args = { p_id: timer.id, p_action: action, p_seconds: seconds, p_at: at };
      await send('update_timer', args, async (tx) => {
        const row = await tx.getOptional<Record<string, unknown>>(
          'select * from timers where id = ?',
          [timer.id],
        );
        if (!row) return;
        const next = applyTimerAction(toTimer(row), action, Date.parse(at), seconds);
        await tx.execute(
          `update timers set ${LOCAL_COLUMNS.map((c) => `${c} = ?`).join(', ')} where id = ?`,
          [...LOCAL_COLUMNS.map((c) => next[c]), timer.id],
        );
      });
    },
    onMutate: async ({ timer, action, seconds = 0, at }) => {
      await queryClient.cancelQueries({ queryKey: keys.timer });
      const before = queryClient.getQueryData<Timer | null>(keys.timer);
      const next = applyTimerAction(timer, action, Date.parse(at), seconds);
      queryClient.setQueryData<Timer | null>(
        keys.timer,
        next.state === 'running' || next.state === 'paused' ? next : null,
      );
      return { before };
    },
    onError: (_err, _vars, context) => queryClient.setQueryData(keys.timer, context?.before),
    onSettled: settle,
  });

  return {
    start: (vars: StartTimerVars) =>
      start.mutateAsync({ ...vars, id: uuidv7(), startedAt: new Date().toISOString() }),
    act: (timer: Timer, action: TimerAction, seconds = 0) =>
      act.mutateAsync({ timer, action, seconds, at: new Date().toISOString() }),
  };
}
