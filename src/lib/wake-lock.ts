import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';

const TAG = 'questlist';

/** Mantém a tela acesa enquanto `active` (descanso e Modo Treino, D126/D127). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    activateKeepAwakeAsync(TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(TAG).catch(() => {});
    };
  }, [active]);
}
