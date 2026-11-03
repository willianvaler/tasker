import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Na web, desenha no <body>: fora dos contêineres com transform ou overflow (a prévia do link, OB6) */
export function BodyPortal({ children }: { children: ReactNode }) {
  return typeof document === 'undefined' ? null : createPortal(children, document.body);
}
