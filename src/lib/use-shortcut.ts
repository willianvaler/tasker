import { useEffect, useEffectEvent } from 'react';
import { Platform } from 'react-native';

import { getShortcutOverrides } from './prefs';
import { allowedWhileTyping, effectiveCombos, matchesCombo, type ShortcutId } from './shortcuts';

export const isMac =
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
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
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

// Enquanto a Ajuda grava uma tecla nova para um atalho (C6), nenhum atalho dispara
let recording = false;
export function setShortcutRecording(on: boolean) {
  recording = on;
}

// Sequências ("g h"): a primeira tecla fica guardada por 1 segundo
const SEQUENCE_MS = 1000;
let lastKey: { key: string; at: number } | null = null;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  // Fase de bolha, depois dos atalhos (que escutam na captura): a tecla de agora não conta como a
  // anterior de si mesma
  window.addEventListener('keydown', (event) => {
    if (isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) lastKey = null;
    else lastKey = { key: event.key.toLowerCase(), at: Date.now() };
  });
}

function matches(combo: string, event: KeyboardEvent) {
  // Espaço sozinho é a tecla, não o separador das sequências ("g h")
  const steps = combo === ' ' ? [combo] : combo.split(' ');
  if (steps.length === 1) return matchesCombo(combo, event, isMac);
  const [first, second] = steps;
  return (
    !!lastKey &&
    lastKey.key === first &&
    Date.now() - lastKey.at < SEQUENCE_MS &&
    matchesCombo(second, event, isMac)
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
    const onKeyDown = (event: KeyboardEvent) => {
      if (recording) return;
      // Lido a cada tecla: a troca feita na Ajuda vale na hora, sem recarregar
      const combos = effectiveCombos(id, getShortcutOverrides());
      const typing = isTyping(event.target);
      if (onControl(event.target, event)) return;
      const hit = combos.some(
        (combo) => (!typing || allowedWhileTyping(combo)) && matches(combo, event),
      );
      if (!hit) return;
      if (trigger() === false) return;
      event.preventDefault();
      lastKey = null;
    };
    // Fase de captura: o TextInput do react-native-web para a propagação do keydown
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [id, enabled]);
}
