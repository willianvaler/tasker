import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../supabase';
import { uuidv7 } from '../uuid';

export type ItemType = 'task' | 'page' | 'folder';
export type Relation = {
  id: string;
  other_type: ItemType;
  other_id: string;
  /** null: o usuário não tem acesso ao outro lado */
  title: string | null;
  icon: string | null;
  can_unlink: boolean;
};
export type Candidate = { type: ItemType; id: string; title: string; context: string | null };

const relKey = (type: ItemType, id: string) => ['relations', type, id] as const;

/** Vínculos "Relacionados" de um item (V3 §2.4). Só online: o título depende do acesso. */
export function useRelations(type: ItemType, id: string | undefined) {
  return useQuery({
    queryKey: relKey(type, id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('item_relations', {
        p_type: type,
        p_id: id ?? '',
      });
      if (error) throw error;
      return data as Relation[];
    },
  });
}

/** Busca para ligar: tarefas, listas e projetos que o usuário vê. */
export function useRelationCandidates(query: string) {
  const term = query.trim();
  return useQuery({
    queryKey: ['relation-candidates', term],
    enabled: term.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('relation_candidates', { p_query: term });
      if (error) throw error;
      return data as Candidate[];
    },
  });
}

export function useRelationMutations(type: ItemType, id: string) {
  const queryClient = useQueryClient();
  const settle = () => queryClient.invalidateQueries({ queryKey: ['relations'] });
  return {
    add: useMutation({
      mutationFn: async (other: { type: ItemType; id: string }) => {
        const { error } = await supabase.from('relations').insert({
          id: uuidv7(),
          from_type: type,
          from_id: id,
          to_type: other.type,
          to_id: other.id,
        } as never);
        if (error) throw error;
      },
      onSettled: settle,
    }),
    remove: useMutation({
      mutationFn: async (relationId: string) => {
        const { error } = await supabase.from('relations').delete().eq('id', relationId);
        if (error) throw error;
      },
      onSettled: settle,
    }),
  };
}
