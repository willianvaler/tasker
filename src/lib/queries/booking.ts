import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { BookingStatus, BookingType } from '../booking';
import { supabase } from '../supabase';
import { sessionUserId } from '../sync/local';

// Agenda e reservas (AG2, D311). A dona configura os tipos e responde às reservas (com conexão,
// fora do sync); a página pública lê e grava só pelas RPCs anônimas, que devolvem os horários
// livres e nada do que ocupa a agenda.

const KEY = ['booking'] as const;

export type OwnerBooking = {
  id: string;
  type_name: string;
  starts_at: string;
  ends_at: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  guest_note: string | null;
  status: BookingStatus;
  cancelled_by: 'guest' | 'owner' | null;
  task_id: string | null;
};

export type BookingTypeInput = Omit<BookingType, 'id'>;

const TYPE_COLUMNS =
  'id, slug, name, description, duration_min, buffer_before, buffer_after, min_notice_min, max_days, daily_limit, ask_phone, ask_note, needs_approval, active';

export function useBookingTypes() {
  return useQuery({
    queryKey: [...KEY, 'types'],
    queryFn: async (): Promise<BookingType[]> => {
      const userId = await sessionUserId();
      if (!userId) return [];
      const { data, error } = await supabase
        .from('booking_types')
        .select(TYPE_COLUMNS)
        .eq('user_id', userId)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as BookingType[];
    },
  });
}

/** Reservas de ontem em diante (as antigas ficam na exportação e somem em 1 ano). */
export function useOwnerBookings() {
  return useQuery({
    queryKey: [...KEY, 'list'],
    queryFn: async (): Promise<OwnerBooking[]> => {
      const userId = await sessionUserId();
      if (!userId) return [];
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { data, error } = await supabase
        .from('bookings')
        .select(
          'id, type_name, starts_at, ends_at, guest_name, guest_email, guest_phone, guest_note, status, cancelled_by, task_id',
        )
        .eq('owner_id', userId)
        .gte('ends_at', since)
        .order('starts_at')
        .limit(200);
      if (error) throw error;
      return (data ?? []) as OwnerBooking[];
    },
  });
}

export function useBookingActions() {
  const queryClient = useQueryClient();
  const settle = () => queryClient.invalidateQueries({ queryKey: KEY });

  const saveType = useMutation({
    mutationFn: async ({ id, ...fields }: BookingTypeInput & { id?: string }) => {
      const { error } = id
        ? await supabase.from('booking_types').update(fields).eq('id', id)
        : await supabase.from('booking_types').insert(fields);
      if (error) throw error;
    },
    onSettled: settle,
  });

  const removeType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('booking_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: settle,
  });

  const respond = useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string;
      action: 'approve' | 'decline' | 'cancel';
    }) => {
      const { error } = await supabase.rpc('respond_booking', { p_id: id, p_action: action });
      if (error) throw error;
    },
    onSettled: () => {
      settle();
      // A aprovação cria a tarefa e o cancelamento a apaga
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  return { saveType, removeType, respond };
}

// ------------------------------------------------------------------
// Página pública (fora do login)
// ------------------------------------------------------------------

export type PublicProfile =
  | { status: 'missing' }
  | {
      status: 'ok';
      name: string;
      username: string;
      timezone: string;
      types: { slug: string; name: string; description: string | null; duration_min: number }[];
    };

export type PublicSlots =
  | { status: 'missing' }
  | {
      status: 'ok';
      owner: string;
      username: string;
      timezone: string;
      type: Pick<
        BookingType,
        | 'slug'
        | 'name'
        | 'description'
        | 'duration_min'
        | 'ask_phone'
        | 'ask_note'
        | 'needs_approval'
        | 'max_days'
      >;
      slots: string[];
    };

export type PublicBooking = {
  type_name: string;
  type_slug: string | null;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  cancelled_by: 'guest' | 'owner' | null;
  guest_name: string;
  owner: string;
  username: string;
  timezone: string;
  can_change: boolean;
};

export type BookResult =
  | { status: 'ok'; token?: string; booking: PublicBooking }
  | { status: 'missing' | 'taken' | 'invalid' | 'limit' | 'closed' };

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  // Os nomes vêm das RPCs públicas da agenda; o tipo gerado não cobre o retorno jsonb
  const { data, error } = await supabase.rpc(name as 'booking_profile', args as never);
  if (error) {
    if ((error as { code?: string }).code === '429' || /Pedidos demais/.test(error.message))
      return { status: 'limit' } as T;
    throw error;
  }
  return data as T;
}

export const fetchBookingProfile = (handle: string) =>
  rpc<PublicProfile>('booking_profile', { p_handle: handle });

export const fetchBookingSlots = (
  handle: string,
  slug: string,
  from: string,
  to: string,
  token?: string | null,
) =>
  rpc<PublicSlots>('booking_slots', {
    p_handle: handle,
    p_slug: slug,
    p_from: from,
    p_to: to,
    p_token: token ?? null,
  });

export const bookSlot = (args: {
  handle: string;
  slug: string;
  starts: string;
  name: string;
  email: string;
  phone?: string;
  note?: string;
}) =>
  rpc<BookResult>('book_slot', {
    p_handle: args.handle,
    p_slug: args.slug,
    p_starts: args.starts,
    p_name: args.name,
    p_email: args.email,
    p_phone: args.phone || null,
    p_note: args.note || null,
  });

export const fetchBookingByToken = (token: string) =>
  rpc<{ status: 'missing' } | { status: 'ok'; booking: PublicBooking }>('booking_by_token', {
    p_token: token,
  });

export const cancelBooking = (token: string) =>
  rpc<BookResult>('cancel_booking', { p_token: token });

export const rescheduleBooking = (token: string, starts: string) =>
  rpc<BookResult>('reschedule_booking', { p_token: token, p_starts: starts });

// ------------------------------------------------------------------
// Achar horário em grupo (AG3, D312)
// ------------------------------------------------------------------

export type GroupSlots = { timezone: string; slots: string[]; no_agenda: string[] };

/** Começos livres para todos (só instantes; quem não configurou a semana vem em `no_agenda`). */
export async function fetchGroupSlots(users: string[], duration: number, days: number) {
  const { data, error } = await supabase.rpc('group_free_slots', {
    p_users: users,
    p_duration: duration,
    p_days: days,
  });
  if (error) throw error;
  return data as unknown as GroupSlots;
}
