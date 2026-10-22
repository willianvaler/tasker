import { expect, test } from '@playwright/test';

import { adminRest, createWorkout, openTab, shown, signUp } from './helpers';

test('calendário: tarefa e treino do dia, e o link para o Google Agenda', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  const id = `${testInfo.project.name}-${Date.now()}`;
  const title = `Conta ${id}`;

  await openTab(page, 'Caixa de entrada');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(`${title} hoje`);
  await input.press('Enter');

  // Treino: um exercício com data vira um item só, com o nome da página
  // (treino é a página da Academia, CD15)
  const pageId = await createWorkout(page, 'Treino Cal');
  const exercise = page.getByRole('textbox', { name: 'Nova tarefa' });
  await exercise.fill('Supino hoje');
  await exercise.press('Enter');
  await expect
    .poll(async () => (await adminRest(`tasks?page_id=eq.${pageId}&select=id`)).length, {
      timeout: 20_000,
    })
    .toBe(1);
  await expect
    .poll(
      async () => (await adminRest(`tasks?title=eq.${encodeURIComponent(title)}&select=id`)).length,
      { timeout: 20_000 },
    )
    .toBe(1);

  await page.goto('/calendario');
  await expect(page.getByRole('heading', { name: 'Calendário' })).toBeVisible();
  await expect(shown(page, title).last()).toBeVisible({ timeout: 20_000 });
  await expect(shown(page, '1 exercício')).toBeVisible();

  // Semana: o dia de hoje continua com os dois
  await page.getByRole('tab', { name: 'Semana' }).click();
  await expect(shown(page, title)).toBeVisible();
  // (no desktop, o treino também está no bloco Academia da barra lateral)
  await page
    .getByRole('link', { name: /Treino Cal/ })
    .last()
    .click();
  await expect(page).toHaveURL(new RegExp(`/page/${pageId}`));

  // Link do feed: o .ics tem a tarefa e o treino
  await page.goto('/calendario');
  await page.getByRole('button', { name: 'Gerar link do calendário' }).click();
  const link = page.getByLabel('Link do calendário');
  await expect(link).toHaveText(/\/calendario\/[\w-]{32}\.ics$/);
  const token = /\/calendario\/([\w-]+)\.ics$/.exec((await link.textContent()) ?? '')?.[1];
  const ics: string = await adminRest('rpc/calendar_ics', {
    method: 'POST',
    body: JSON.stringify({ p_token: token, p_origin: 'https://tasker.exemplo.org' }),
  });
  const body = ics.replace(/\r\n /g, '');
  expect(body).toContain(`SUMMARY:${title}`);
  expect(body).toContain('SUMMARY:🏋 Treino Cal');
  expect(body).toContain(`URL:https://tasker.exemplo.org/page/${pageId}`);
  await expect(page.getByRole('button', { name: 'Adicionar ao Google Agenda' })).toBeVisible();

  // Trocar o link derruba o antigo
  await page.getByRole('button', { name: 'Trocar link' }).click();
  await page.getByRole('button', { name: 'Trocar link' }).last().click();
  await expect(page.getByText('Link trocado. Adicione o novo no seu calendário.')).toBeVisible();
  await expect(link).not.toHaveText(new RegExp(token ?? 'x'));
  const old = await adminRest('rpc/calendar_ics', {
    method: 'POST',
    body: JSON.stringify({ p_token: token }),
  });
  expect(old).toBeNull();
});
