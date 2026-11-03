// O react-dom vem com o react-native-web e não tem tipos instalados; o app usa só o createPortal
// (body-portal.web.tsx).
declare module 'react-dom' {
  import type { ReactNode, ReactPortal } from 'react';
  export function createPortal(children: ReactNode, container: Element): ReactPortal;
}
