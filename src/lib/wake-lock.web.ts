import { useEffect } from 'react';

/**
 * Mantém a tela acesa enquanto `active` (Wake Lock, J4/D126). O navegador solta a trava quando a
 * aba some; ao voltar, pede de novo. Sem suporte (Firefox antigo, http), não faz nada.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let done = false;
    const acquire = () => {
      if (done || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      navigator.wakeLock.request('screen').then(
        (sentinel) => {
          if (done) sentinel.release().catch(() => {});
          else lock = sentinel;
        },
        () => {},
      );
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      done = true;
      document.removeEventListener('visibilitychange', acquire);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
