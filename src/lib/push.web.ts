// Na web não há push (D58): os avisos ficam no sino 🔔, que atualiza em tempo real.
export const pushSupported = false;

export type PushResult = { ok: true } | { ok: false; reason: string };

export async function enablePush(): Promise<PushResult> {
  return { ok: false, reason: 'No navegador, os avisos aparecem no sino 🔔.' };
}

export async function disablePush() {}

export function usePushTapHandler() {}

export function hasPushToken() {
  return false;
}
