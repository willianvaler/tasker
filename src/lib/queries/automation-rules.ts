import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Definicao } from '../automation/editor';
import type { Json, Tables } from '../db';
import { supabase } from '../supabase';

// Automações do V14 (AU7, D341): a lista, o editor, o histórico e os controles. Tudo online (quem
// roda é o servidor), como as automações de projeto da D143.

export type Rule = Tables<'automation_rules'>;
export type Run = Pick<
  Tables<'automation_runs'>,
  'id' | 'status' | 'started_at' | 'finished_at' | 'error' | 'steps' | 'warnings' | 'step'
>;

const KEY = 'automation-rules';

/** As pessoais (escopo 'pessoal') ou as de um projeto (folderId). */
export function useRules(folderId?: string) {
  return useQuery({
    queryKey: [KEY, folderId ?? 'pessoal'],
    queryFn: async () => {
      let q = supabase.from('automation_rules').select('*').order('created_at');
      q = folderId ? q.eq('folder_id', folderId) : q.eq('scope', 'pessoal');
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useRule(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'uma', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('id', id ?? '')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Últimas 50 execuções da regra (V14 §6.5). */
export function useRuns(ruleId: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'execucoes', ruleId],
    enabled: !!ruleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_runs')
        .select('id, status, started_at, finished_at, error, steps, warnings, step')
        .eq('rule_id', ruleId ?? '')
        .order('started_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Run[];
    },
  });
}

export type Uso = {
  pausado: boolean;
  hora: number;
  limite_hora: number;
  limite_regra_hora: number;
  limite_avisos_hora: number;
  falhas_para_desligar: number;
};

export function useUsage() {
  return useQuery({
    queryKey: [KEY, 'uso'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('automation_usage');
      if (error) throw error;
      return data as unknown as Uso;
    },
  });
}

/** Nomes dos segredos guardados da regra (os valores nunca voltam). */
export function useSecretNames(ruleId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [KEY, 'segredos', ruleId],
    enabled: !!ruleId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('automation_secret_names', {
        p_rule: ruleId ?? '',
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useHook(ruleId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [KEY, 'hook', ruleId],
    enabled: !!ruleId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_hooks')
        .select('id, require_signature, last_used_at, created_at')
        .eq('rule_id', ruleId ?? '')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useRuleMutations() {
  const qc = useQueryClient();
  const settle = () => qc.invalidateQueries({ queryKey: [KEY] });
  return {
    save: useMutation({
      mutationFn: async (r: {
        id?: string;
        scope: 'pessoal' | 'projeto';
        folderId?: string;
        name: string;
        definition: Definicao;
        enabled?: boolean;
      }) => {
        const definition = r.definition as unknown as NonNullable<Json>;
        if (r.id) {
          const { error } = await supabase
            .from('automation_rules')
            .update({
              name: r.name,
              definition,
              ...(r.enabled === undefined ? {} : { enabled: r.enabled }),
            })
            .eq('id', r.id);
          if (error) throw error;
          return r.id;
        }
        const { data, error } = await supabase
          .from('automation_rules')
          .insert({
            scope: r.scope,
            name: r.name,
            definition,
            ...(r.folderId ? { folder_id: r.folderId } : {}),
          })
          .select('id')
          .single();
        if (error) throw error;
        return data.id;
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
    runNow: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.rpc('automation_run_now', { p_rule: id });
        if (error) throw error;
      },
      onSettled: settle,
    }),
    pause: useMutation({
      mutationFn: async (paused: boolean) => {
        const { error } = await supabase.rpc('set_automations_paused', { p_paused: paused });
        if (error) throw error;
      },
      onSettled: settle,
    }),
    hookCreate: useMutation({
      mutationFn: async (id: string) => {
        const { data, error } = await supabase.rpc('automation_hook_create', { p_rule: id });
        if (error) throw error;
        return data;
      },
      onSettled: settle,
    }),
    hookSignature: useMutation({
      mutationFn: async ({ id, require }: { id: string; require: boolean }) => {
        const { error } = await supabase.rpc('automation_hook_require_signature', {
          p_rule: id,
          p_require: require,
        });
        if (error) throw error;
      },
      onSettled: settle,
    }),
    signingSecret: useMutation({
      mutationFn: async (id: string) => {
        const { data, error } = await supabase.rpc('automation_signing_secret', { p_rule: id });
        if (error) throw error;
        return data;
      },
      onSettled: settle,
    }),
    secretSet: useMutation({
      mutationFn: async (s: { id: string; name: string; value: string }) => {
        const { error } = await supabase.rpc('automation_secret_set', {
          p_rule: s.id,
          p_name: s.name,
          p_value: s.value,
        });
        if (error) throw error;
      },
      onSettled: settle,
    }),
  };
}
