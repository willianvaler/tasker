import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { clearSessionEnded, currentSession, noteSignedOut, storedSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

type SessionState = { session: Session | null; isLoading: boolean };

const SessionContext = createContext<SessionState>({ session: null, isLoading: true });

export function SessionProvider({ children }: { children: ReactNode }) {
  // A sessão guardada abre o app na hora (D179); a renovação, que espera o servidor, atualiza depois
  const [state, setState] = useState<SessionState>(() => {
    const stored = storedSession();
    return { session: stored, isLoading: !stored };
  });

  useEffect(() => {
    // V4 §7.1 (D179): servidor fora do ar não tira ninguém da conta. Na abertura, com o token
    // vencido e sem resposta do servidor, vale a sessão guardada no aparelho
    currentSession().then((session) =>
      setState((prev) => ({ session: session ?? prev.session, isLoading: false })),
    );
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Sessão nula sem ter saído (a renovação do token falhou sem servidor) não derruba quem
      // está usando: o Stack.Protected desmontava e montava o app inteiro a cada tentativa.
      // Só o "sair" de verdade (ou o servidor recusando a sessão, que a apaga) limpa. Aqui só a
      // leitura do armazenamento: chamar o Supabase dentro deste aviso trava a biblioteca
      const fallback = !session && event !== 'SIGNED_OUT' ? storedSession() : null;
      if (event === 'SIGNED_OUT') noteSignedOut();
      if (session) clearSessionEnded();
      setState((prev) =>
        session
          ? { session, isLoading: false }
          : event === 'SIGNED_OUT'
            ? { session: null, isLoading: false }
            : { session: fallback ?? prev.session, isLoading: false },
      );
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
