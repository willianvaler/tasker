import { useEffect, useEffectEvent } from 'react';
import { Platform } from 'react-native';

import { allowedWhileTyping, findShortcut, matchesCombo, type ShortcutId } from './shortcuts';

const isMac =
  Platform.OS === 'web' &&
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

/**
 * Liga um atalho do registro (lib/shortcuts.ts) a uma ação, na web. Quem chama decide se vale
 * agora (`enabled`), inclusive pela permissão do atalho.
 */
export function useShortcut(id: ShortcutId, onTrigger: () => void, enabled = true) {
  const trigger = useEffectEvent(onTrigger);
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const { combos } = findShortcut(id);
    const onKeyDown = (event: KeyboardEvent) => {
      const typing = isTyping(event.target);
      const hit = combos.some(
        (combo) => (!typing || allowedWhileTyping(combo)) && matchesCombo(combo, event, isMac),
      );
      if (!hit) return;
      event.preventDefault();
      trigger();
    };
    // Fase de captura: o TextInput do react-native-web para a propagação do keydown
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [id, enabled]);
}
