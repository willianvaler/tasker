import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Tables } from '../db';
import { todayIn } from '../parser/dates';
import { supabase } from '../supabase';
import { useSession } from '@/providers/session';
import { keys } from './keys';

export type Profile = Tables<'profiles'>;

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export function useProfile() {
  const { session } = useSession();
  return useQuery({
    queryKey: keys.profile,
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session?.user.id ?? '')
        .single();
      if (error) throw error;
      return data;
    },
  });
}

/** Fuso do perfil (padrão America/Sao_Paulo enquanto carrega). */
export function useTimeZone() {
  const { data } = useProfile();
  return data?.timezone ?? DEFAULT_TIMEZONE;
}

/** Hoje ('YYYY-MM-DD') no fuso do perfil. */
export function useToday() {
  return todayIn(useTimeZone());
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  return useMutation({
    mutationFn: async (patch: { display_name?: string; timezone?: string }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', session?.user.id ?? '')
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.profile, profile);
      queryClient.invalidateQueries({ queryKey: keys.tasks });
    },
  });
}
