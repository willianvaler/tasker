import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  rulesFromWeek,
  type AvailabilityException,
  type Week,
  type WeekRule,
} from '../availability';
import type { IsoDate } from '../parser/dates';
import { supabase } from '../supabase';
import { sessionUserId } from '../sync/local';

// Disponibilidade da agenda (AG1, D310): só da pessoa e fora do sync. Configurar pede conexão,
// como diz o escopo (a página de reservas, AG2, é do servidor de qualquer jeito).

export type AvailabilityData = { rules: WeekRule[]; exceptions: AvailabilityException[] };
export type NewException = Omit<AvailabilityException, 'id'>;

const KEY = ['availability'] as const;

/** A semana e as exceções que ainda não passaram. Só JSON (vai para o cache). */
export function useAvailability(today: IsoDate) {
  return useQuery({
    queryKey: [...KEY, today],
    queryFn: async (): Promise<AvailabilityData> => {
      const userId = await sessionUserId();
      if (!userId) return { rules: [], exceptions: [] };
      const [rules, exceptions] = await Promise.all([
        supabase
          .from('availability_rules')
          .select('weekday, starts, ends')
          .eq('user_id', userId)
          .order('weekday')
          .order('starts'),
        supabase
          .from('availability_exceptions')
          .select('id, starts_on, ends_on, starts, ends, note')
          .eq('user_id', userId)
          .gte('ends_on', today)
          .order('starts_on'),
      ]);
      if (rules.error) throw rules.error;
      if (exceptions.error) throw exceptions.error;
      return { rules: rules.data ?? [], exceptions: exceptions.data ?? [] };
    },
  });
}

export function useAvailabilityActions() {
  const queryClient = useQueryClient();
  const settle = () => queryClient.invalidateQueries({ queryKey: KEY });

  const saveWeek = useMutation({
    mutationFn: async (week: Week) => {
      const { error } = await supabase.rpc('set_availability', { p_rules: rulesFromWeek(week) });
      if (error) throw error;
    },
    onSettled: settle,
  });

  const addException = useMutation({
    mutationFn: async (exception: NewException) => {
      const { error } = await supabase.from('availability_exceptions').insert(exception);
      if (error) throw error;
    },
    onSettled: settle,
  });

  const removeException = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('availability_exceptions').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: settle,
  });

  return { saveWeek, addException, removeException };
}
