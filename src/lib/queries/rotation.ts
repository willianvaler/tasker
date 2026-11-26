import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { readRotation, type RotationMode } from '../rotation';
import { supabase } from '../supabase';
import { keys } from './keys';

/**
 * Rodízio da tarefa (CS2, D381): só pelo servidor (a vez muda por regra dele). Sem conexão, a tela
 * mostra o responsável que já está no aparelho e esconde os controles.
 */
export const rotationKey = (taskId: string) => ['rotation', taskId] as const;

export function useTaskRotation(taskId: string, enabled = true) {
  return useQuery({
    queryKey: rotationKey(taskId),
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('task_rotation_state', { p_task: taskId });
      if (error) throw error;
      return readRotation(data);
    },
  });
}

export function useRotationMutations(taskId: string) {
  const queryClient = useQueryClient();
  const settle = () => {
    void queryClient.invalidateQueries({ queryKey: rotationKey(taskId) });
    void queryClient.invalidateQueries({ queryKey: keys.assignees });
    void queryClient.invalidateQueries({ queryKey: keys.mine });
  };
  const set = useMutation({
    mutationFn: async ({ members, mode }: { members: string[]; mode: RotationMode }) => {
      const { error } = await supabase.rpc('set_task_rotation', {
        p_task: taskId,
        p_members: members,
        p_mode: mode,
      });
      if (error) throw error;
    },
    onSettled: settle,
  });
  /** Sem `to`: pula a vez; com `to`: troca de lugar com essa pessoa. */
  const pass = useMutation({
    mutationFn: async (to?: string) => {
      const { error } = await supabase.rpc('rotation_pass', {
        p_task: taskId,
        ...(to ? { p_to: to } : {}),
      });
      if (error) throw error;
    },
    onSettled: settle,
  });
  return { set, pass };
}
