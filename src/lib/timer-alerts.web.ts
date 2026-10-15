import i18n from '@/i18n';

import { localStore } from './storage';
import type { Timer } from './timers';

// Aviso do fim do timer na web (J4, D126). O navegador não agenda notificação para o futuro: a
// página guarda um setTimeout para o `ends_at` (um só, não encadeado, então mesmo em aba escondida
// atrasa no máximo ~1 s) e, se a aba não estiver à vista, mostra o aviso pelo Service Worker, toca
// um som (Web Audio) e vibra onde há vibração. Aba fechada não avisa (limitações no D126).

const ASKED_KEY = 'questlist:timer-permission-asked';

const hasNotification = () => typeof Notification !== 'undefined';
export const alertsSupported = hasNotification();
/** Vibração existe no Chrome do Android; no iOS (Safari) e no computador, não. */
export const canVibrate = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;

export const permissionAsked = () =>
  !hasNotification() ||
  Notification.permission !== 'default' ||
  localStore.getItem(ASKED_KEY) === '1';

function registerWorker() {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.register('/sw.js').catch(() => null);
}

export async function ensureAlertPermission(): Promise<boolean> {
  primeAudio();
  if (!hasNotification()) return false;
  localStore.setItem(ASKED_KEY, '1');
  const granted =
    Notification.permission === 'granted' || (await Notification.requestPermission()) === 'granted';
  if (granted) await registerWorker();
  return granted;
}

// ---- Som ----------------------------------------------------------------------------------

let audio: AudioContext | null = null;

/**
 * O navegador só deixa tocar som depois de um toque do usuário: o contexto nasce (ou volta)
 * no toque que inicia o timer.
 */
export function primeAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  } catch {
    audio = null;
  }
}

/** Três bipes curtos. */
function beep() {
  if (!audio) return;
  const start = audio.currentTime + 0.05;
  for (let i = 0; i < 3; i++) {
    const at = start + i * 0.25;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
    osc.connect(gain).connect(audio.destination);
    osc.start(at);
    osc.stop(at + 0.2);
  }
}

// ---- Aviso ----------------------------------------------------------------------------------

export function alertText(timer: Timer) {
  const { label, after } = (timer.config ?? {}) as { label?: string; after?: boolean };
  if (timer.kind === 'rest')
    return {
      title: i18n.t('timer.restOver'),
      body: !label
        ? i18n.t('timer.backToIt')
        : i18n.t(after ? 'timer.nextItem' : 'timer.nextSet', { label }),
    };
  return { title: i18n.t('timer.timeUp'), body: label ?? i18n.t('timer.countdown') };
}

async function notify(timer: Timer) {
  if (!hasNotification() || Notification.permission !== 'granted') return;
  const { title, body } = alertText(timer);
  const options = { body, tag: timer.id, icon: '/favicon.ico' };
  const worker = await registerWorker();
  if (worker) {
    await worker.showNotification(title, options);
    return;
  }
  try {
    new Notification(title, options);
  } catch {
    // Sem Service Worker e sem construtor (Chrome do Android): fica só o som
  }
}

let pending: { id: string; handle: ReturnType<typeof setTimeout> } | null = null;

/** Liga o aviso ao timer ativo: rodando, marca a hora; parado ou pausado, desmarca. */
export async function syncTimerAlert(timer: Timer | null, _previousId: string | null) {
  if (pending) clearTimeout(pending.handle);
  pending = null;
  if (!timer || timer.state !== 'running' || !timer.ends_at) return;
  const wait = Date.parse(timer.ends_at) - Date.now();
  if (wait <= 0) return;
  pending = {
    id: timer.id,
    handle: setTimeout(() => {
      pending = null;
      // À vista, a mini-barra já avisa (timerFinishedHere); escondida, o aviso vem daqui
      if (document.visibilityState === 'visible') return;
      timerFinishedHere(timer.id);
      notify(timer).catch(() => {});
    }, wait),
  };
}

let lastFinished: string | null = null;

/** Fim do timer: som e, onde houver, vibração. Uma vez por timer (aviso e mini-barra chamam). */
export function timerFinishedHere(timerId: string) {
  if (lastFinished === timerId) return;
  lastFinished = timerId;
  beep();
  if (canVibrate()) navigator.vibrate([200, 100, 200]);
}
