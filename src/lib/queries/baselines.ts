import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { readBaselineItems, type Baseline } from '../baseline';
import { supabase } from '../supabase';

// Linhas de base do Gantt (GP2, D314): fotos das datas do projeto. Ler e salvar pedem conexão; sem
// ela fica o último resultado em cache (o Gantt segue funcionando sem a comparação).

const KEY = ['baselines'] as const;

export function useBaselines(rootId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, rootId ?? ''],
    enabled: !!rootId,
    queryFn: async (): Promise<Baseline[]> => {
      const { data, error } = await supabase
        .from('baselines')
        .select('id, name, created_at, items')
        .eq('folder_id', rootId ?? '')
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map((b) => ({ ...b, items: readBaselineItems(b.items) }));
    },
  });
}

export function useBaselineActions(rootId: string) {
  const queryClient = useQueryClient();
  const settle = () => queryClient.invalidateQueries({ queryKey: KEY });
  const save = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.rpc('save_baseline', { p_root: rootId, p_name: name });
      if (error) throw error;
      return data as string;
    },
    onSettled: settle,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('baselines').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: settle,
  });
  return { save, remove };
}
