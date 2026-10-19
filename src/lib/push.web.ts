import { tr } from './i18n-ref';

// Na web não há push: os avisos ficam no sino 🔔, que atualiza em tempo real.
export const pushSupported = false;

export type PushResult = { ok: true } | { ok: false; reason: string };

export async function enablePush(): Promise<PushResult> {
  return { ok: false, reason: tr('push.browser') };
}

export async function disablePush() {}

export async function updatePushLocale(_locale: string) {}

export function usePushTapHandler() {}

export function hasPushToken() {
  return false;
}
