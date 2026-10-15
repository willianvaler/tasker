import type { Timer } from './timers';

// Na web o aviso do fim do timer é da J4 (Notification + Service Worker, Web Audio).

export const alertsSupported = false;
export const permissionAsked = () => true;
export async function ensureAlertPermission() {
  return false;
}
export async function syncTimerAlert(_timer: Timer | null, _previousId: string | null) {}
export function timerFinishedHere() {}
