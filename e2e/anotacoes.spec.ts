import { expect, test } from '@playwright/test';

import { openTab, signUp } from './helpers';

// W3: anotações simples. No computador ficam na barra lateral; no celular, no Início.
test('anotações: criar, salvar sozinho, aparecer no bloco e apagar', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  if (testInfo.project.name !== 'desktop') await openTab(page, 'Início');
  await page.getByRole('button', { name: 'Nova anotação' }).first().click();
  const title = `Mercado ${testInfo.project.name} ${Date.now()}`;
  await page.getByRole('textbox', { name: 'Título da anotação' }).fill(title);
  await page.getByRole('textbox', { name: 'Texto da anotação' }).fill('leite\npão\ncafé');
  await expect(page.getByText('14/20000')).toBeVisible();
  // Salva sozinho: recarregar não perde
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Texto da anotação' })).toHaveValue(
    'leite\npão\ncafé',
    {
      timeout: 15_000,
    },
  );
  await page.goto('/notas');
  // Na lista (no computador o título também está na barra lateral)
  const item = page.getByRole('link', { name: new RegExp(`^${title} .*leite`) });
  await expect(item).toBeVisible();
  await item.click();
  await page.getByRole('button', { name: 'Apagar' }).click();
  await page.getByRole('button', { name: 'Apagar' }).last().click();
  await expect(page.getByText(title)).toHaveCount(0);
});
