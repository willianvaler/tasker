import { isLocale, type LocalePreference } from '@/i18n/locale';

import { localStore } from './storage';
import { uuidv7 } from './uuid';

// Preferências de UI guardadas no aparelho (não são dados do usuário: perder não faz mal).
const LAST_PAGE_KEY = 'questlist:last-page';
const OPEN_FOLDERS_KEY = 'questlist:open-folders';
const THEME_KEY = 'questlist:theme';
const LOCALE_KEY = 'questlist:locale';
const RECENT_ICONS_KEY = 'questlist:recent-icons';
const DEVICE_KEY = 'questlist:device';

export type ThemePreference = 'system' | 'light' | 'dark';

/** Tema do aparelho. Fica mesmo ao sair da conta (é do aparelho, não do usuário). */
export function getThemePreference(): ThemePreference {
  const value = localStore.getItem(THEME_KEY);
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function setThemePreference(value: ThemePreference) {
  localStore.setItem(THEME_KEY, value);
}

/** Idioma escolhido no aparelho ('system' = o do aparelho). */
export function getLocalePreference(): LocalePreference {
  const value = localStore.getItem(LOCALE_KEY);
  return isLocale(value) ? value : 'system';
}

export function setLocalePreference(value: LocalePreference) {
  localStore.setItem(LOCALE_KEY, value);
}

/** Ícones usados por último (no topo do seletor), do mais novo para o mais antigo. */
export function getRecentIcons(): string[] {
  try {
    const list: unknown = JSON.parse(localStore.getItem(RECENT_ICONS_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((v) => typeof v === 'string').slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function pushRecentIcon(value: string) {
  const next = [value, ...getRecentIcons().filter((v) => v !== value)].slice(0, 8);
  localStore.setItem(RECENT_ICONS_KEY, JSON.stringify(next));
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

const SIDEBAR_WIDTH_KEY = 'questlist:sidebar-width';
export const SIDEBAR_WIDTH = { min: 200, max: 480, default: 256 } as const;

/** Largura da barra lateral escolhida no divisor (só computador). */
export function getSidebarWidth(): number {
  const value = Number(localStore.getItem(SIDEBAR_WIDTH_KEY));
  return value >= SIDEBAR_WIDTH.min && value <= SIDEBAR_WIDTH.max ? value : SIDEBAR_WIDTH.default;
}

export function setSidebarWidth(width: number) {
  localStore.setItem(SIDEBAR_WIDTH_KEY, String(Math.round(width)));
}

export function clearPrefs() {
  localStore.removeItem(LAST_PAGE_KEY);
  localStore.removeItem(OPEN_FOLDERS_KEY);
}

const SYNC_USER_KEY = 'questlist-sync-user';

/** De quem é o banco do aparelho (troca de conta limpa antes de sincronizar a nova). */
export function getSyncUser() {
  return localStore.getItem(SYNC_USER_KEY);
}

export function setSyncUser(userId: string | null) {
  if (userId) localStore.setItem(SYNC_USER_KEY, userId);
  else localStore.removeItem(SYNC_USER_KEY);
}

/** Id deste aparelho (timers: de onde veio o ativo). Gerado uma vez. */
export function getDeviceId(): string {
  let id = localStore.getItem(DEVICE_KEY);
  if (!id) {
    id = uuidv7();
    localStore.setItem(DEVICE_KEY, id);
  }
  return id;
}
