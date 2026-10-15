import { expect, test, type Page } from '@playwright/test';

import { openTab, signUp, waitForSync } from './helpers';

// A mini-barra (o painel da tarefa tem a contagem grande, "Descanso: faltam…")
const bar = (page: Page) => page.getByRole('timer', { name: /^(?!Descanso: faltam)/ });

test('timer: um ativo, com fim absoluto, o mesmo nos dois aparelhos', async ({
  browser,
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'A paleta (Ctrl+K) é do computador');
  test.setTimeout(90_000);
  const email = await signUp(page, testInfo);

  // Iniciar pela paleta
  await page.keyboard.press('Control+k');
  await page.getByRole('textbox', { name: 'Buscar ou executar' }).fill('temporizador de 5');
  await page.keyboard.press('Enter');
  await expect(bar(page)).toHaveAccessibleName(/^Temporizador: 4:5\d$|^Temporizador: 5:00$/);

  // Recarregar não zera: o restante vem do horário de fim
  await waitForSync(page);
  await page.reload();
  await expect(bar(page)).toHaveAccessibleName(/^Temporizador: 4:[45]\d$/, { timeout: 15_000 });

  // O mesmo usuário em outro aparelho vê o mesmo timer e pausa
  const other = await browser.newContext({ ...testInfo.project.use, locale: 'pt-BR' });
  const b = await other.newPage();
  await b.goto('/');
  await b.getByPlaceholder('E-mail').fill(email);
  await b.getByPlaceholder('Senha').fill('senha-forte-123');
  await b.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(bar(b)).toHaveAccessibleName(/^Temporizador: 4:[45]\d$/, { timeout: 20_000 });
  await b.getByRole('button', { name: 'Pausar' }).click();
  await expect(bar(b)).toHaveAccessibleName(/, pausado$/);
  await expect(bar(page)).toHaveAccessibleName(/, pausado$/, { timeout: 20_000 });

  // Um ativo por pessoa: o cronômetro novo substitui o temporizador
  await page.keyboard.press('Control+k');
  await page.getByRole('textbox', { name: 'Buscar ou executar' }).fill('cronômetro');
  await page.keyboard.press('Enter');
  await expect(bar(page)).toHaveAccessibleName(/^Cronômetro: 0:0\d$/);
  await expect(bar(b)).toHaveAccessibleName(/^Cronômetro: /, { timeout: 20_000 });
  await expect(bar(b)).toHaveCount(1);

  // Parar em um some no outro
  await b.getByRole('button', { name: 'Parar' }).click();
  await expect(bar(b)).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0, { timeout: 20_000 });
  await other.close();
});

test('descanso: começa depois da série, +30/−30, termina sozinho, Pular e desfazer cancelam', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Supino 3x10');
  await input.press('Enter');

  // Descanso curto, para o teste
  await page.getByRole('button', { name: 'Detalhes de Supino' }).click();
  const rest = page.getByRole('textbox', { name: 'Descanso entre (s)' });
  await expect(rest).toHaveValue('60');
  await rest.fill('3');
  await rest.press('Enter');
  await expect(rest).toHaveValue('3');

  // Série feita: o descanso começa sozinho, com a próxima série no rótulo
  await page.getByRole('button', { name: 'Série feita' }).click();
  const panel = page.getByRole('timer', { name: /^Descanso: faltam/ });
  await expect(panel).toBeVisible();
  await expect(bar(page)).toHaveAccessibleName(/^Descanso · Supino, 2\/3: 0:0\d$/);
  await panel.getByRole('button', { name: 'Mais 30 segundos' }).click();
  await expect(panel).toHaveAccessibleName(/faltam 0:3\d$/);
  await panel.getByRole('button', { name: 'Menos 30 segundos' }).click();
  await expect(panel).toHaveAccessibleName(/faltam 0:0\d$/);
  // Chega a zero e some
  await expect(bar(page)).toHaveCount(0, { timeout: 10_000 });

  // Pular
  await page.getByRole('button', { name: 'Série feita' }).click();
  await expect(bar(page)).toHaveAccessibleName(/Supino, 3\/3/);
  await bar(page).getByRole('button', { name: 'Pular' }).click();
  await expect(bar(page)).toHaveCount(0);

  // Desfazer a série cancela o descanso dela
  await rest.fill('60');
  await rest.press('Enter');
  await page.getByRole('button', { name: 'Desfazer a última' }).click();
  await page.getByRole('button', { name: 'Série feita' }).click();
  await expect(bar(page)).toHaveAccessibleName(/Supino, 3\/3/);
  await page.getByRole('button', { name: 'Desfazer a última' }).click();
  await expect(bar(page)).toHaveCount(0);
});

test('web: aba escondida recebe o aviso pelo Service Worker; tela fica acesa no descanso', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Igual nos dois perfis');
  test.setTimeout(90_000);
  // Aba "escondida" sob comando, permissão concedida (o Chromium sem janela sempre recusa) e
  // espiões no aviso e no Wake Lock
  await page.addInitScript(() => {
    Object.defineProperty(Notification, 'permission', { get: () => 'granted' });
    Notification.requestPermission = async () => 'granted';
    const w = window as any;
    w.__hidden = false;
    w.__wake = 0;
    w.__shown = [];
    Object.defineProperty(document, 'visibilityState', {
      get: () => (w.__hidden ? 'hidden' : 'visible'),
    });
    Object.defineProperty(navigator, 'wakeLock', {
      value: {
        request: async () => {
          w.__wake++;
          return { released: false, release: async () => {} };
        },
      },
    });
    const original = ServiceWorkerRegistration.prototype.showNotification;
    ServiceWorkerRegistration.prototype.showNotification = function (title, options) {
      w.__shown.push({ title, body: options?.body });
      return original.call(this, title, options).catch(() => {});
    };
  });
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Remada 3x10');
  await input.press('Enter');
  await page.getByRole('button', { name: 'Detalhes de Remada' }).click();
  const rest = page.getByRole('textbox', { name: 'Descanso entre (s)' });
  await rest.fill('3');
  await rest.press('Enter');

  await page.getByRole('button', { name: 'Série feita' }).click();
  await expect(bar(page)).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__wake)).toBeGreaterThan(0);

  // Usuário trocou de aba: o aviso vem do Service Worker, com a próxima série
  await page.evaluate(() => ((window as any).__hidden = true));
  await expect
    .poll(() => page.evaluate(() => (window as any).__shown), { timeout: 10_000 })
    .toEqual([{ title: 'Fim do descanso', body: 'Hora da próxima série: Remada, 2/3' }]);
  expect(
    await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration('/sw.js'))),
  ).toBe(true);
});
