import { expect, test, type Page } from '@playwright/test';

import { openTab, signUp } from './helpers';

/**
 * Reconhecedor de mentira no lugar do `webkitSpeechRecognition` do Chrome (que no Playwright não
 * tem o serviço do Google): ao começar, "ouve" as frases de `window.__frases`, uma por pausa, e para.
 */
async function fakeSpeech(page: Page, phrases: string[]) {
  await page.addInitScript((list) => {
    class FakeRecognition extends EventTarget {
      lang = '';
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      start() {
        const fire = (type: string, extra: object = {}) =>
          this.dispatchEvent(Object.assign(new Event(type), extra));
        setTimeout(() => {
          fire('start');
          const results: unknown[] = [];
          list.forEach((transcript, i) => {
            const alt = { transcript, confidence: 0.9 };
            const interim = Object.assign(
              [{ transcript: transcript.split(' ')[0], confidence: 0.5 }],
              {
                isFinal: false,
              },
            );
            fire('result', { resultIndex: i, results: [...results, interim] });
            results.push(Object.assign([alt], { isFinal: true }));
            fire('result', { resultIndex: i, results: [...results] });
          });
          fire('end');
        }, 50);
      }
      stop() {}
      abort() {}
    }
    Object.assign(window, { webkitSpeechRecognition: FakeRecognition });
  }, phrases);
}

// PB7 (V3 §6 B, D302): ditar uma lista em "Adicionar várias"; cada pausa é uma tarefa e "próximo
// item" separa sem parar.
test('voz: falar a lista vira tarefas na criação em lote', async ({ page }, testInfo) => {
  await fakeSpeech(page, ['comprar pão amanhã', 'leite próximo item café !!']);
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  await page.getByRole('button', { name: 'Adicionar várias' }).click();
  await page.getByRole('button', { name: 'Falar a lista' }).click();
  const text = page.getByRole('textbox', { name: 'Lista de tarefas' });
  await expect(text).toHaveValue('Comprar pão amanhã\nLeite\nCafé !!');
  await page.getByRole('button', { name: 'Criar 3' }).click();
  await expect(page.getByRole('checkbox', { name: 'Concluir Comprar pão' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Concluir Café' })).toBeVisible();
});
