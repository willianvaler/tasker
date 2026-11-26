import { expect, test } from '@playwright/test';

import { createPage, shown, signUp, waitForSync } from './helpers';

// CS4 (D390): abaixo do mínimo, o item entra na lista de compras sem duplicar (é o servidor que
// cria); marcar comprado soma ao estoque.
test('despensa: acabou vai para as compras uma vez e comprar soma ao estoque', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  await waitForSync(page);
  await createPage(page, { folder: `Casa ${Date.now()}`, name: 'Despensa', type: 'Despensa' });

  await page.getByRole('button', { name: 'Criar a lista Compras' }).click();
  await expect(shown(page, 'Lista de compras: Compras')).toBeVisible();

  await page.getByRole('button', { name: 'Novo item' }).click();
  await page.getByRole('textbox', { name: 'Item (ex.: Arroz)' }).fill('Arroz');
  await page.getByRole('textbox', { name: 'Quanto tem' }).fill('3');
  await page.getByRole('textbox', { name: 'Unidade' }).fill('kg');
  await page.getByRole('textbox', { name: 'Mínimo' }).fill('2');
  await page.getByRole('textbox', { name: 'Comprar de cada vez' }).fill('5');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByLabel('Arroz: 3 kg')).toBeVisible();
  await expect(shown(page, 'Mínimo: 2 kg')).toBeVisible();

  // Abaixo do mínimo e depois acabou: uma compra só
  await page.getByRole('button', { name: 'Tirar 1 de Arroz' }).click();
  await page.getByRole('button', { name: 'Tirar 1 de Arroz' }).click();
  await expect(shown(page, 'Na lista de compras')).toBeVisible();
  await page.getByRole('button', { name: 'Acabou: Arroz' }).click();
  await expect(page.getByLabel('Arroz: 0 kg')).toBeVisible();
  await waitForSync(page);

  await page.getByRole('button', { name: 'Abrir', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Compras$/ })).toBeVisible();
  const buy = page.getByRole('checkbox', { name: 'Concluir Arroz (5 kg)' });
  await expect(buy).toBeVisible({ timeout: 20_000 });
  await expect(buy).toHaveCount(1);
  await buy.click();
  await waitForSync(page);

  // De volta à despensa: 0 + 5 kg
  await page.goBack();
  await expect(async () => {
    await expect(page.getByLabel('Arroz: 5 kg')).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  await expect(shown(page, 'Mínimo: 2 kg')).toBeVisible();
});
