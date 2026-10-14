import { expect, test } from '@playwright/test';

import { adminRest, openTab, shown, signUp } from './helpers';

test('lixeira: apagar a tarefa e restaurar', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  const title = `Lixo ${testInfo.project.name} ${Date.now()}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(title);
  await input.press('Enter');
  await expect
    .poll(
      async () => (await adminRest(`tasks?title=eq.${encodeURIComponent(title)}&select=id`)).length,
      {
        timeout: 20_000,
      },
    )
    .toBe(1);

  await page.getByRole('button', { name: `Detalhes de ${title}` }).click();
  await page.getByRole('button', { name: 'Apagar tarefa' }).click();
  await page.getByRole('button', { name: 'Apagar', exact: true }).click();
  await expect
    .poll(
      async () => (await adminRest(`tasks?title=eq.${encodeURIComponent(title)}&select=id`)).length,
      {
        timeout: 20_000,
      },
    )
    .toBe(0);

  await page.goto('/lixeira');
  await expect(page.getByText(title)).toBeVisible();
  await page.getByRole('button', { name: 'Restaurar' }).click();
  await expect(page.getByText(`Restaurado: ${title}`)).toBeVisible();
  await expect(page.getByText('Nada apagado nos últimos 30 dias.')).toBeVisible();

  await page.goto('/inbox');
  await expect(shown(page, title)).toBeVisible({ timeout: 20_000 });
});
