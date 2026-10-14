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

/** Botão ou link com foco: Enter e Espaço são dele (apertar), não de um atalho de lista. */
function onControl(target: EventTarget | null, event: KeyboardEvent) {
  const el = target as HTMLElement | null;
  if (!el || (event.key !== 'Enter' && event.key !== ' ')) return false;
  const role = el.getAttribute?.('role');
  return (
    el.tagName === 'BUTTON' ||
    el.tagName === 'A' ||
    role === 'button' ||
    role === 'link' ||
    role === 'checkbox' ||
    role === 'radio' ||
    role === 'menuitem' ||
    role === 'switch'
  );
}

/**
 * Liga um atalho do registro (lib/shortcuts.ts) a uma ação, na web. Quem chama decide se vale
 * agora (`enabled`), inclusive pela permissão do atalho. Se a ação devolver `false` (não havia o
 * que fazer), a tecla segue para a tela normalmente.
 */
export function useShortcut(id: ShortcutId, onTrigger: () => void | boolean, enabled = true) {
  const trigger = useEffectEvent(onTrigger);
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const { combos } = findShortcut(id);
    const onKeyDown = (event: KeyboardEvent) => {
      const typing = isTyping(event.target);
      if (onControl(event.target, event)) return;
      const hit = combos.some(
        (combo) => (!typing || allowedWhileTyping(combo)) && matchesCombo(combo, event, isMac),
      );
      if (!hit) return;
      if (trigger() === false) return;
      event.preventDefault();
    };
    // Fase de captura: o TextInput do react-native-web para a propagação do keydown
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [id, enabled]);
}
