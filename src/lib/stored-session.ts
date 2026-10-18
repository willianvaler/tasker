import type { Session } from '@supabase/supabase-js';

// Leitura da sessão guardada pelo Supabase no aparelho (D179). Função pura, com testes.

/** Sessão guardada (JSON do Supabase) → sessão utilizável; formato estranho vira nada. */
export function parseStoredSession(raw: string | null | undefined): Session | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Session> | null;
    if (
      !value ||
      typeof value.access_token !== 'string' ||
      typeof value.refresh_token !== 'string' ||
      typeof value.user?.id !== 'string'
    )
      return null;
    return value as Session;
  } catch {
    return null;
  }
}
