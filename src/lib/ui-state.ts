import { useSyncExternalStore } from 'react';

import { localStore } from './storage';

// Estado de interface que atalhos globais mudam: barra lateral escondida (Ctrl+B) e o campo de
// captura da tela em foco (Q/N põe o foco nele). Fora do React, como a seleção (lib/selection.ts).

const SIDEBAR_KEY = 'questlist:sidebar-hidden';

let sidebarHidden = localStore.getItem(SIDEBAR_KEY) === '1';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function toggleSidebar() {
  sidebarHidden = !sidebarHidden;
  localStore.setItem(SIDEBAR_KEY, sidebarHidden ? '1' : '0');
  notify();
}

export function useSidebarHidden() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => sidebarHidden,
    () => sidebarHidden,
  );
}

/** Foco no campo de captura da tela em foco; a tela registra (e tira) a função. */
let focusCapture: (() => void) | null = null;
export function setCaptureFocus(fn: (() => void) | null) {
  focusCapture = fn;
}
/** Põe o foco na captura da tela; devolve false se a tela não tem campo de captura. */
export function focusCaptureField() {
  if (!focusCapture) return false;
  focusCapture();
  return true;
}
