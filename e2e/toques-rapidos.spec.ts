import { expect, test, type Locator } from '@playwright/test';

import { createPage, signUp, waitForSync } from './helpers';

// Toques seguidos no + do contador: cada um esperava até 3 s pela resposta do servidor antes do
// próximo entrar no banco do aparelho; fechando o app no meio, os da fila se perdiam
test('hábito contador: cinco toques seguidos contam os cinco', async ({ page }, testInfo) => {
  const onScreen = (l: Locator) => l.and(page.locator(':not([aria-hidden="true"] *)'));
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Rotina', name: 'Hábitos', type: 'Hábitos' });
  const water = `Copos ${testInfo.project.name} ${Date.now()}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(water);
  await input.press('Enter');
  await waitForSync(page);

  await page.getByRole('button', { name: `Detalhes de ${water}` }).click();
  await page.getByRole('radio', { name: /Contador/ }).click();
  const meta = page.getByLabel('Meta por período');
  await meta.fill('8');
  await meta.press('Enter');
  await waitForSync(page);
  await page.getByRole('button', { name: 'Voltar' }).click();

  // Servidor lento como pelo túnel no celular: cada comando demora para responder
  await page.route('**/rpc/run_once', async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  const plus = page.getByRole('button', { name: `Mais um: ${water}` });
  for (let i = 0; i < 5; i++) await plus.click();
  await expect(onScreen(page.getByLabel('5 de 8'))).toBeVisible();
  // O que a tela mostra já tem que estar no banco do aparelho (o que sobrevive a fechar o app no
  // celular), não preso na fila esperando a resposta do servidor de cada toque
  const local = () =>
    page.evaluate(async (title) => {
      const db = (window as unknown as { questlistDb?: any }).questlistDb;
      const row = await db?.getOptional('select count_up from tasks where title = ?', [title]);
      return row?.count_up ?? null;
    }, water);
  await expect.poll(local, { timeout: 2500 }).toBe(5);
  await waitForSync(page);
  await page.reload();
  await expect(onScreen(page.getByLabel('5 de 8'))).toBeVisible();
});
