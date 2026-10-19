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
const GAME_SOUNDS_KEY = 'questlist:game-sounds';
const SHORTCUTS_KEY = 'questlist:shortcuts';

export type ThemePreference = 'system' | 'light' | 'dark';

/** Tema do aparelho. Fica mesmo ao sair da conta (é do aparelho, não do usuário). */
export function getThemePreference(): ThemePreference {
  const value = localStore.getItem(THEME_KEY);
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function setThemePreference(value: ThemePreference) {
  localStore.setItem(THEME_KEY, value);
}

/** Sons do modo jogo (HB11): ligados por padrão, desligáveis no Perfil. É do aparelho. */
export function getGameSounds(): boolean {
  return localStore.getItem(GAME_SOUNDS_KEY) !== 'off';
}

export function setGameSounds(on: boolean) {
  localStore.setItem(GAME_SOUNDS_KEY, on ? 'on' : 'off');
}

/** Atalhos trocados (C6): id → combinação. É do aparelho (cada teclado é um). */
let shortcutCache: Record<string, string> | null = null;
const shortcutListeners = new Set<() => void>();

export function getShortcutOverrides(): Record<string, string> {
  if (shortcutCache) return shortcutCache;
  try {
    const value: unknown = JSON.parse(localStore.getItem(SHORTCUTS_KEY) ?? '{}');
    shortcutCache =
      value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(
            Object.entries(value).filter(([, v]) => typeof v === 'string' && v.length > 0),
          )
        : {};
  } catch {
    shortcutCache = {};
  }
  return shortcutCache;
}

/** Troca (ou, com null, devolve ao de fábrica) a tecla de um atalho. */
export function setShortcutOverride(id: string, combo: string | null) {
  const next = { ...getShortcutOverrides() };
  if (combo) next[id] = combo;
  else delete next[id];
  shortcutCache = next;
  localStore.setItem(SHORTCUTS_KEY, JSON.stringify(next));
  shortcutListeners.forEach((fn) => fn());
}

export function resetShortcutOverrides() {
  shortcutCache = {};
  localStore.setItem(SHORTCUTS_KEY, '{}');
  shortcutListeners.forEach((fn) => fn());
}

export function subscribeShortcutOverrides(fn: () => void) {
  shortcutListeners.add(fn);
  return () => {
    shortcutListeners.delete(fn);
  };
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

const SYNC_READY_KEY = 'questlist-sync-ready';

/**
 * O banco do aparelho já terminou uma sincronização completa para a conta atual (D179). Ao abrir
 * sem servidor, o PowerSync só diz "sincronizado" depois de conectar; com esta marca o app usa o
 * aparelho desde o começo (senão a tarefa criada nesse meio-tempo ia pelo servidor e se perdia).
 */
export function getSyncReady() {
  return localStore.getItem(SYNC_READY_KEY) === '1';
}

export function setSyncReady(ready: boolean) {
  if (ready) localStore.setItem(SYNC_READY_KEY, '1');
  else localStore.removeItem(SYNC_READY_KEY);
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

const PANEL_MODE_KEY = 'questlist:panel-mode';
export type PanelMode = 'simple' | 'full';

/** Painel da tarefa simples ou completo (U2). Simples por padrão. */
export function getPanelMode(): PanelMode {
  return localStore.getItem(PANEL_MODE_KEY) === 'full' ? 'full' : 'simple';
}

export function setPanelMode(value: PanelMode) {
  localStore.setItem(PANEL_MODE_KEY, value);
}
