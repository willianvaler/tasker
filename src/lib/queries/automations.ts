import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Json, Tables } from '../db';
import { supabase } from '../supabase';

// Automações (M6, D143): ficam no servidor (quem roda é ele); a tela precisa de conexão.

export type AutomationRule = Tables<'automation_rules'>;
const rulesKey = (folderId: string) => ['automations', folderId] as const;

export function useAutomations(folderId: string | undefined) {
  return useQuery({
    queryKey: rulesKey(folderId ?? ''),
    enabled: !!folderId,
    queryFn: async () => {
      const [rules, log] = await Promise.all([
        supabase
          .from('automation_rules')
          .select('*')
          .eq('folder_id', folderId ?? '')
          .order('created_at'),
        supabase
          .from('automation_log')
          .select('id, rule_id, at, ok, message, rule:automation_rules!inner(folder_id)')
          .eq('rule.folder_id', folderId ?? '')
          .order('at', { ascending: false })
          .limit(20),
      ]);
      if (rules.error) throw rules.error;
      if (log.error) throw log.error;
      return { rules: rules.data, log: log.data };
    },
  });
}

export function useAutomationMutations(folderId: string) {
  const queryClient = useQueryClient();
  const settle = () => queryClient.invalidateQueries({ queryKey: rulesKey(folderId) });
  return {
    add: useMutation({
      mutationFn: async (rule: {
        trigger: string;
        action: string;
        page_id: string | null;
        params: Record<string, unknown>;
      }) => {
        const { error } = await supabase
          .from('automation_rules')
          .insert({ ...rule, folder_id: folderId, params: rule.params as NonNullable<Json> });
        if (error) throw error;
      },
      onSettled: settle,
    }),
    toggle: useMutation({
      mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
        const { error } = await supabase.from('automation_rules').update({ enabled }).eq('id', id);
        if (error) throw error;
      },
      onSettled: settle,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('automation_rules').delete().eq('id', id);
        if (error) throw error;
      },
      onSettled: settle,
    }),
  };
}
