import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../supabase';
import { sessionUserId } from '../sync/local';
import type { PollSlot } from '../time-poll';

// Enquete de horário (AG4, D319). A dona lê as três tabelas pela RLS e grava pelas RPCs (com
// conexão, fora do sync, como as reservas); o link público lê e vota pelas RPCs anônimas.

const KEY = ['time-polls'] as const;

export type OwnerPoll = {
  id: string;
  title: string;
  duration_min: number;
  note: string | null;
  token: string;
  status: 'open' | 'closed';
  chosen_slot: string | null;
  task_id: string | null;
  created_at: string;
  slots: { id: string; starts_at: string }[];
  votes: { id: string; name: string; email: string | null; slots: string[] }[];
};

// Os horários têm duas ligações com a enquete (a dela e o `chosen_slot`): o embed diz qual
const COLUMNS =
  'id, title, duration_min, note, token, status, chosen_slot, task_id, created_at, slots:time_poll_slots!time_poll_slots_poll_id_fkey(id, starts_at), votes:time_poll_votes(id, name, email, slots)';

const sorted = (poll: OwnerPoll): OwnerPoll => ({
  ...poll,
  slots: [...poll.slots].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)),
});

export function useTimePolls() {
  return useQuery({
    queryKey: [...KEY, 'list'],
    queryFn: async (): Promise<OwnerPoll[]> => {
      const userId = await sessionUserId();
      if (!userId) return [];
      const { data, error } = await supabase
        .from('time_polls')
        .select(COLUMNS)
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as OwnerPoll[]).map(sorted);
    },
  });
}

export function useTimePoll(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'one', id ?? ''],
    enabled: !!id,
    queryFn: async (): Promise<OwnerPoll | null> => {
      const { data, error } = await supabase
        .from('time_polls')
        .select(COLUMNS)
        .eq('id', id ?? '')
        .maybeSingle();
      if (error) throw error;
      return data ? sorted(data as unknown as OwnerPoll) : null;
    },
  });
}

/** Os horários com os nomes de quem marcou (o mesmo formato do link público). */
export const ownerSlots = (poll: OwnerPoll): PollSlot[] =>
  poll.slots.map((s) => ({
    id: s.id,
    starts_at: s.starts_at,
    names: poll.votes.filter((v) => v.slots.includes(s.id)).map((v) => v.name),
  }));

export function useTimePollActions() {
  const queryClient = useQueryClient();
  const settle = () => queryClient.invalidateQueries({ queryKey: KEY });
  const save = useMutation({
    mutationFn: async (input: {
      id: string;
      title: string;
      duration: number;
      note: string;
      slots: string[];
    }) => {
      const { data, error } = await supabase.rpc('save_time_poll', {
        p_id: input.id,
        p_title: input.title,
        p_duration: input.duration,
        p_note: input.note,
        p_slots: input.slots,
      });
      if (error) throw error;
      return data as string;
    },
    onSettled: settle,
  });
  const close = useMutation({
    mutationFn: async ({ id, slot }: { id: string; slot: string }) => {
      const { data, error } = await supabase.rpc('close_time_poll', { p_id: id, p_slot: slot });
      if (error) throw error;
      return data as string;
    },
    onSettled: () => {
      settle();
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tree'] });
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('time_polls').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: settle,
  });
  return { save, close, remove };
}

// ------------------------------------------------------------------
// Link público (sem conta)
// ------------------------------------------------------------------

export type PublicPoll = {
  title: string;
  note: string | null;
  duration_min: number;
  state: 'open' | 'closed';
  owner: string;
  timezone: string | null;
  chosen: string | null;
  voters: number;
  slots: PollSlot[];
  mine: { name: string; email: string | null; slots: string[] } | null;
};
export type PollResult =
  { status: 'ok'; poll: PublicPoll } | { status: 'missing' | 'closed' | 'invalid' | 'limit' };

async function rpc(name: string, args: Record<string, unknown>): Promise<PollResult> {
  // O tipo gerado não cobre o retorno jsonb
  const { data, error } = await supabase.rpc(name as 'time_poll_public', args as never);
  if (error) {
    if ((error as { code?: string }).code === '429' || /Pedidos demais/.test(error.message))
      return { status: 'limit' };
    throw error;
  }
  return data as unknown as PollResult;
}

export const fetchPublicPoll = (token: string, voter: string | null) =>
  rpc('time_poll_public', { p_token: token, p_voter: voter });

export const votePoll = (input: {
  token: string;
  voter: string;
  name: string;
  email: string;
  slots: string[];
}) =>
  rpc('time_poll_vote', {
    p_token: input.token,
    p_voter: input.voter,
    p_name: input.name,
    p_email: input.email,
    p_slots: input.slots,
  });
