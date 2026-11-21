import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ProjectBudget } from '../budget';
import { supabase } from '../supabase';

// Orçamento do projeto e valor da hora (GP4, D316). Pede conexão: o valor de cada pessoa é do
// servidor (RLS e a RPC devolvem só o que a pessoa pode ver).

const KEY = ['budget'] as const;

export function useProjectBudget(rootId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'summary', rootId ?? ''],
    enabled: !!rootId,
    queryFn: async (): Promise<ProjectBudget> => {
      const { data, error } = await supabase.rpc('project_budget', { p_root: rootId ?? '' });
      if (error) throw error;
      return data as unknown as ProjectBudget;
    },
  });
}

export type ProjectRate = {
  id: string;
  user_id: string | null;
  cents_per_hour: number;
  currency: string;
};

/** Quem gerencia vê todos; os outros, só o próprio. */
export function useProjectRates(rootId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'rates', rootId ?? ''],
    enabled: !!rootId,
    queryFn: async (): Promise<ProjectRate[]> => {
      const { data, error } = await supabase
        .from('project_rates')
        .select('id, user_id, cents_per_hour, currency')
        .eq('folder_id', rootId ?? '');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Grava os valores (null apaga o da pessoa, que volta a usar o padrão). */
export function useSaveRates(rootId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      current,
      next,
    }: {
      current: ProjectRate[];
      next: { userId: string | null; cents: number | null }[];
    }) => {
      for (const { userId, cents } of next) {
        const row = current.find((r) => r.user_id === userId);
        if (cents == null) {
          if (row) {
            const { error } = await supabase.from('project_rates').delete().eq('id', row.id);
            if (error) throw error;
          }
          continue;
        }
        if (row && row.cents_per_hour === cents) continue;
        const { error } = row
          ? await supabase.from('project_rates').update({ cents_per_hour: cents }).eq('id', row.id)
          : await supabase
              .from('project_rates')
              .insert({ folder_id: rootId, user_id: userId, cents_per_hour: cents });
        if (error) throw error;
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
