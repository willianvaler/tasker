import type { ReactNode } from 'react';

/** No celular não há <body>: desenha no lugar (a versão da web fica em body-portal.web.tsx) */
export function BodyPortal({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
