import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Grafo } from '../processo';
import type { Json, Tables } from '../db';
import { supabase } from '../supabase';

// Processos (ESCOPO_V16 Parte B, D349 a D353): definições, versões, instâncias e o histórico. Tudo
// online (quem roda é o servidor); a tarefa humana em si é uma tarefa normal e anda pelo sync.

export type Definicao = Tables<'process_definitions'>;
export type Instancia = Tables<'process_instances'>;
export type PassoHist = Tables<'process_steps'>;

const KEY = 'processos';

export function useDefinitions() {
  return useQuery({
    queryKey: [KEY, 'definicoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('process_definitions')
        .select('*')
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

export function useDefinition(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'definicao', id],
    enabled: !!id,
    queryFn: async () => {
      const [d, v] = await Promise.all([
        supabase
          .from('process_definitions')
          .select('*')
          .eq('id', id ?? '')
          .maybeSingle(),
        supabase
          .from('process_versions')
          .select('id, number, published_at, signature')
          .eq('definition_id', id ?? '')
          .order('number', { ascending: false }),
      ]);
      if (d.error) throw d.error;
      if (v.error) throw v.error;
      return { definicao: d.data, versoes: v.data };
    },
  });
}

export function useInstances(definitionId?: string) {
  return useQuery({
    queryKey: [KEY, 'instancias', definitionId ?? 'todas'],
    queryFn: async () => {
      let q = supabase
        .from('process_instances')
        .select(
          'id, definition_id, status, started_at, finished_at, error, steps_count, page_id, process_definitions(name)',
        )
        .order('started_at', { ascending: false })
        .limit(100);
      if (definitionId) q = q.eq('definition_id', definitionId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

/** Os processos que começaram por uma anotação (o cartão "Processos desta página", PR7). */
export function usePageInstances(pageId: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'pagina', pageId],
    enabled: !!pageId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('process_instances')
        .select('id, status, started_at, process_definitions(name)')
        .eq('page_id', pageId ?? '')
        .order('started_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });
}

/** Uma instância com o grafo da versão dela, os tokens vivos e o histórico (PR5, §9). */
export function useInstance(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'instancia', id],
    enabled: !!id,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data: inst, error } = await supabase
        .from('process_instances')
        .select('*, process_versions(graph, number), process_definitions(name)')
        .eq('id', id ?? '')
        .maybeSingle();
      if (error) throw error;
      const [tokens, passos] = await Promise.all([
        supabase
          .from('process_tokens')
          .select('id, node_id, status')
          .eq('instance_id', id ?? ''),
        supabase
          .from('process_steps')
          .select('*')
          .eq('instance_id', id ?? '')
          .order('started_at'),
      ]);
      return {
        instancia: inst,
        grafo: (inst?.process_versions as unknown as { graph: Grafo } | null)?.graph ?? null,
        tokens: tokens.data ?? [],
        passos: (passos.data ?? []) as PassoHist[],
      };
    },
  });
}

export function useProcessMutations() {
  const qc = useQueryClient();
  const settle = () => qc.invalidateQueries({ queryKey: [KEY] });
  return {
    create: useMutation({
      mutationFn: async (d: { name: string; draft: Grafo; is_function?: boolean }) => {
        const { data, error } = await supabase
          .from('process_definitions')
          .insert({
            name: d.name,
            draft: d.draft as unknown as NonNullable<Json>,
            is_function: d.is_function ?? false,
          })
          .select('id')
          .single();
        if (error) throw error;
        return data.id;
      },
      onSettled: settle,
    }),
    save: useMutation({
      mutationFn: async (d: {
        id: string;
        name?: string;
        description?: string;
        draft?: Grafo;
        active?: boolean;
        is_function?: boolean;
      }) => {
        const { id, draft, ...rest } = d;
        const { error } = await supabase
          .from('process_definitions')
          .update({ ...rest, ...(draft ? { draft: draft as unknown as NonNullable<Json> } : {}) })
          .eq('id', id);
        if (error) throw error;
      },
      onSettled: settle,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('process_definitions').delete().eq('id', id);
        if (error) throw error;
      },
      onSettled: settle,
    }),
    publish: useMutation({
      mutationFn: async (id: string) => {
        const { data, error } = await supabase.rpc('process_publish', { p_definition: id });
        if (error) throw error;
        return data;
      },
      onSettled: settle,
    }),
    start: useMutation({
      mutationFn: async (d: { id: string; vars?: Record<string, unknown> }) => {
        const { data, error } = await supabase.rpc('process_start', {
          p_definition: d.id,
          p_vars: (d.vars ?? {}) as unknown as NonNullable<Json>,
        });
        if (error) throw error;
        return data;
      },
      onSettled: settle,
    }),
    cancel: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.rpc('process_cancel', { p_instance: id });
        if (error) throw error;
      },
      onSettled: settle,
    }),
    suspend: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.rpc('process_suspend', { p_instance: id });
        if (error) throw error;
      },
      onSettled: settle,
    }),
    resume: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.rpc('process_resume', { p_instance: id });
        if (error) throw error;
      },
      onSettled: settle,
    }),
  };
}

/** Ações da tarefa humana (PR6): responder, delegar, devolver ao grupo. */
export function useProcessTaskActions() {
  const qc = useQueryClient();
  const settle = () => {
    void qc.invalidateQueries({ queryKey: ['tasks'] });
    void qc.invalidateQueries({ queryKey: [KEY] });
  };
  return {
    complete: useMutation({
      mutationFn: async (d: {
        task: string;
        escolha?: string;
        formulario: Record<string, unknown>;
      }) => {
        const { error } = await supabase.rpc('process_complete_task', {
          p_task: d.task,
          p_escolha: d.escolha ?? (null as unknown as string),
          p_formulario: d.formulario as unknown as NonNullable<Json>,
        });
        if (error) throw error;
      },
      onSettled: settle,
    }),
    delegate: useMutation({
      mutationFn: async (d: { task: string; pessoa: string }) => {
        const { error } = await supabase.rpc('process_delegate', {
          p_task: d.task,
          p_pessoa: d.pessoa,
        });
        if (error) throw error;
      },
      onSettled: settle,
    }),
    giveBack: useMutation({
      mutationFn: async (task: string) => {
        const { error } = await supabase.rpc('process_return_task', { p_task: task });
        if (error) throw error;
      },
      onSettled: settle,
    }),
  };
}
