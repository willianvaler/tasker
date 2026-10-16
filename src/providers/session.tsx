import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

type SessionState = { session: Session | null; isLoading: boolean };

const SessionContext = createContext<SessionState>({ session: null, isLoading: true });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, isLoading: true });

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setState({ session: data.session, isLoading: false }));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Sessão nula sem ter saído (a renovação do token falhou sem internet) não derruba quem
      // está usando: o Stack.Protected desmontava e montava o app inteiro a cada tentativa
      // (painel aberto perdia o que estava sendo feito). Só o "sair" de verdade limpa
      setState((prev) =>
        !session && event !== 'SIGNED_OUT' && prev.session
          ? { ...prev, isLoading: false }
          : { session, isLoading: false },
      );
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
