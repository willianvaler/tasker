import { expect, test } from '@playwright/test';

import { openTab, shown, signUp } from './helpers';

// GP4 (D316): orçamento do projeto e valor da hora (quem gerencia define; a tela soma o trabalho e
// os gastos, previsto × realizado).
test('orçamento: valor da hora, totais e CSV', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const name = `Cliente ${Date.now()}`;
  await signUp(page, testInfo);
  await openTab(page, 'Pastas');
  await page.getByRole('button', { name: 'Usar modelo' }).click();
  await page.getByRole('button', { name: 'Kit Reforma' }).click();
  await page.getByPlaceholder('Nome').fill(name);
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Orçamento do projeto' }).click();
  await expect(page.getByRole('heading', { name: 'Orçamento' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Trabalho' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('group', { name: 'Total' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Baixar CSV' })).toBeVisible();

  const rate = page.getByRole('textbox', { name: 'Padrão do projeto' });
  await rate.fill('abc');
  await expect(shown(page, 'Valor inválido em Padrão do projeto')).toBeVisible();
  await rate.fill('60,00');
  const saved = page.waitForResponse((r) => r.url().includes('project_rates') && r.ok());
  await page.getByRole('button', { name: 'Salvar valores' }).click();
  await saved;
  await expect(shown(page, 'Valores salvos')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Padrão do projeto' })).toHaveValue('60,00', {
    timeout: 15_000,
  });
});
