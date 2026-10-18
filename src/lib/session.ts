import type { Session } from '@supabase/supabase-js';

import { parseStoredSession } from './stored-session';
import { supabase } from './supabase';
import { authStorage } from './storage';

// Sessão que sobrevive ao servidor fora do ar (V4 §7.1, D179). Com o token vencido (1 h) e o
// servidor sem responder, o `getSession()` devolve sessão nula, mas ela continua guardada no
// aparelho: a biblioteca só a apaga quando o servidor recusa de fato (senha trocada, sessão
// revogada) ou no "sair". Enquanto ela estiver guardada, a pessoa continua dentro, usando o banco
// do aparelho; a renovação automática tenta de novo e, quando o servidor volta, o app recebe um
// token novo (TOKEN_REFRESHED) sem pedir login.

const storageKey = () => (supabase.auth as unknown as { storageKey: string }).storageKey;

/** A sessão guardada no aparelho, mesmo com o token vencido. Não fala com o servidor. */
export function storedSession(): Session | null {
  try {
    return parseStoredSession(authStorage.getItem(storageKey()));
  } catch {
    return null;
  }
}

/**
 * Sessão para usar agora: a do Supabase (renovada se precisou e deu) ou, se a renovação não
 * conseguiu falar com o servidor, a guardada no aparelho. `local`: só a guardada, na hora (para
 * saber quem está logado não precisa do servidor; com ele fora, o getSession() espera até 30 s).
 */
export async function currentSession({ local = false } = {}): Promise<Session | null> {
  const stored = storedSession();
  if (local && stored) return stored;
  const { data } = await supabase.auth.getSession();
  return data.session ?? stored ?? storedSession();
}

// "Sua sessão terminou": só quando o servidor encerrou (senha trocada, sessão revogada). Sair
// pelo Perfil ou excluir a conta passa por signOut(), que marca a saída como intencional
const ENDED_KEY = 'questlist:sessao-encerrada';
let intentional = false;

/** Sair da conta por vontade da pessoa (a tela de login não avisa nada). */
export async function signOut() {
  intentional = true;
  try {
    await supabase.auth.signOut();
  } finally {
    intentional = false;
  }
}

/** Chamado no SIGNED_OUT: saída que ninguém pediu fica anotada para a tela de login. */
export function noteSignedOut() {
  if (intentional) return;
  try {
    authStorage.setItem(ENDED_KEY, '1');
  } catch {
    // Sem armazenamento: só não avisa
  }
}

export function sessionEnded() {
  try {
    return authStorage.getItem(ENDED_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearSessionEnded() {
  try {
    authStorage.removeItem(ENDED_KEY);
  } catch {
    // nada a limpar
  }
}
