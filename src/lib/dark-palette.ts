import { useSyncExternalStore } from 'react';

import { localStore } from './storage';

// Fundo do modo escuro (CD29). É do aparelho, como o tema (prefs.ts): perder não faz mal. Fica num
// store à parte para o useColors (lib/tokens.ts) ler sem depender de um provider.
const KEY = 'questlist:dark-palette';
const IDS = ['brown', 'green', 'blue', 'graphite', 'black', 'plum'] as const;
type Id = (typeof IDS)[number];

const listeners = new Set<() => void>();

function read(): Id {
  try {
    const value = localStore.getItem(KEY);
    return (IDS as readonly string[]).includes(value ?? '') ? (value as Id) : 'brown';
  } catch {
    return 'brown';
  }
}

let current: Id = read();

export function getDarkPalette(): Id {
  return current;
}

export function setDarkPalette(value: Id) {
  current = value;
  try {
    localStore.setItem(KEY, value);
  } catch {
    // Sem armazenamento: vale até fechar o app
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDarkPalette(): Id {
  return useSyncExternalStore(subscribe, getDarkPalette, getDarkPalette);
}
