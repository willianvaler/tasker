import { expect, test } from '@playwright/test';

import { openTab, signUp } from './helpers';

test('marcos do projeto: criar com data, concluir e continuar depois de recarregar', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Pastas');
  await page.getByRole('button', { name: 'Usar modelo' }).click();
  await page.getByRole('button', { name: 'Modelo Churrasco' }).click();
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Churrasco' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nova lista' })).toBeVisible();

  const field = page.getByRole('textbox', { name: 'Novo marco (ex.: Compras sexta)' });
  await field.fill('Comprar carne amanhã');
  await field.press('Enter');
  await field.fill('Montar a mesa');
  await field.press('Enter');
  await expect(page.getByText('Comprar carne', { exact: true })).toBeVisible();
  await expect(page.getByText(/· amanhã$/)).toBeVisible();
  await expect(page.getByText('sem data', { exact: true })).toBeVisible();

  await page.getByRole('checkbox', { name: 'Concluir Comprar carne' }).click();
  await expect(page.getByRole('checkbox', { name: 'Reabrir Comprar carne' })).toBeVisible();
  // Espera a fila subir antes de recarregar
  await expect(page.getByRole('link', { name: /^Sincronizado$/ }).first()).toBeAttached({
    timeout: 15_000,
  });
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Reabrir Comprar carne' })).toBeVisible({
    timeout: 15_000,
  });
});
