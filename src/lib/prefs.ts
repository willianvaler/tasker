import { localStore } from './storage';

// Preferências de UI guardadas no aparelho (não são dados do usuário: perder não faz mal).
const LAST_PAGE_KEY = 'questlist:last-page';
const OPEN_FOLDERS_KEY = 'questlist:open-folders';
const THEME_KEY = 'questlist:theme';

export type ThemePreference = 'system' | 'light' | 'dark';

/** Tema do aparelho. Fica mesmo ao sair da conta (é do aparelho, não do usuário). */
export function getThemePreference(): ThemePreference {
  const value = localStore.getItem(THEME_KEY);
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function setThemePreference(value: ThemePreference) {
  localStore.setItem(THEME_KEY, value);
}

export function getLastPageId(): string | null {
  return localStore.getItem(LAST_PAGE_KEY);
}

export function setLastPageId(pageId: string) {
  localStore.setItem(LAST_PAGE_KEY, pageId);
}

/** Pastas abertas na árvore da barra lateral. */
export function getOpenFolders(): string[] {
  try {
    const ids: unknown = JSON.parse(localStore.getItem(OPEN_FOLDERS_KEY) ?? '[]');
    return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function setOpenFolders(ids: string[]) {
  localStore.setItem(OPEN_FOLDERS_KEY, JSON.stringify(ids));
}

export function clearPrefs() {
  localStore.removeItem(LAST_PAGE_KEY);
  localStore.removeItem(OPEN_FOLDERS_KEY);
}
