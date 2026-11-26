import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, sessionUserId } from '../sync/local';

/**
 * Dado sensível (SA0, D382). O consentimento é por finalidade (`sensitive_consents`, D239): dar e
 * tirar é ato no servidor, com data; ler funciona sem conexão (a tabela vem pelo sync). Revogar
 * apaga os dados daquela finalidade.
 */
export type SensitivePurpose = 'body_metrics' | 'medications' | 'health';

export const consentKey = (purpose: SensitivePurpose) => ['sensitive-consent', purpose] as const;

export function useSensitiveConsent(purpose: SensitivePurpose) {
  return useQuery({
    queryKey: consentKey(purpose),
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async () => {
      if (isLocal()) {
        const userId = await sessionUserId();
        if (!userId) return false;
        const row = await db.getOptional<{ id: string }>(
          'select id from sensitive_consents where user_id = ? and purpose = ? and revoked_at is null',
          [userId, purpose],
        );
        if (row) return true;
        // Recém-dado no servidor, a linha ainda não chegou ao aparelho: pergunta ao servidor (sem
        // conexão, vale o aparelho). Senão a tela voltava ao pedido de consentimento por segundos
        const { data, error } = await supabase.rpc('has_sensitive_consent', { p_purpose: purpose });
        return !error && data === true;
      }
      const { data, error } = await supabase.rpc('has_sensitive_consent', { p_purpose: purpose });
      if (error) throw error;
      return data === true;
    },
  });
}

export function useSensitiveConsentAction(purpose: SensitivePurpose) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (give: boolean) => {
      const { error } = await supabase.rpc(
        give ? 'grant_sensitive_consent' : 'revoke_sensitive_consent',
        { p_purpose: purpose },
      );
      if (error) throw error;
    },
    onSuccess: (_r, give) => queryClient.setQueryData(consentKey(purpose), give),
    onSettled: () => queryClient.invalidateQueries({ queryKey: consentKey(purpose) }),
  });
}

/** Campos sensíveis liberados para sair por webhook (V15-4): o motor recusa os outros. */
const RELEASES = ['sensitive-releases'] as const;

export function useSensitiveReleases() {
  return useQuery({
    queryKey: RELEASES,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sensitive_releases')
        .select('field')
        .order('field');
      if (error) throw error;
      return (data ?? []).map((r) => r.field);
    },
  });
}

export function useSensitiveReleaseActions() {
  const queryClient = useQueryClient();
  const settle = () => queryClient.invalidateQueries({ queryKey: RELEASES });
  const add = useMutation({
    mutationFn: async (field: string) => {
      const { data, error } = await supabase.rpc('release_sensitive_field', { p_field: field });
      if (error) throw error;
      return data;
    },
    onSettled: settle,
  });
  const remove = useMutation({
    mutationFn: async (field: string) => {
      const { error } = await supabase.rpc('unrelease_sensitive_field', { p_field: field });
      if (error) throw error;
    },
    onSettled: settle,
  });
  return { add, remove };
}
