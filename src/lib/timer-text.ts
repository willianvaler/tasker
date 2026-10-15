import i18n from '@/i18n';

import type { Timer } from './timers';

/**
 * Texto do aviso de fim do timer (celular e web): "Hora da próxima série: Supino reto, 3/4",
 * "Fim do foco · Pausa: buscar um café".
 */
export function alertText(timer: Timer) {
  const { label, after, phase, idea } = (timer.config ?? {}) as {
    label?: string;
    after?: boolean;
    phase?: string;
    idea?: string;
  };
  if (timer.kind === 'rest')
    return {
      title: i18n.t('timer.restOver'),
      body: !label
        ? i18n.t('timer.backToIt')
        : i18n.t(after ? 'timer.nextItem' : 'timer.nextSet', { label }),
    };
  if (timer.kind === 'pomodoro') {
    if (phase === 'short' || phase === 'long')
      return {
        title: i18n.t('pomodoro.breakOver'),
        body: label ? i18n.t('pomodoro.backTo', { label }) : i18n.t('pomodoro.backToFocus'),
      };
    return {
      title: i18n.t('pomodoro.focusOver'),
      body: idea ? i18n.t('pomodoro.breakIdea', { idea }) : i18n.t('pomodoro.takeBreak'),
    };
  }
  return { title: i18n.t('timer.timeUp'), body: label ?? i18n.t('timer.countdown') };
}
