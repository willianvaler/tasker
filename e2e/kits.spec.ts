import { expect, test } from '@playwright/test';

import { openTab, signUp } from './helpers';

// PB6 (V3 §6 B, D301): o kit Reforma cria o projeto com as etapas em ordem (cada uma espera a
// anterior) e a página de gastos com o orçamento.
test('kit Reforma: etapas em ordem e orçamento', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Pastas');
  await page.getByRole('button', { name: 'Usar modelo' }).click();
  await page.getByRole('button', { name: 'Kit Reforma' }).click();
  const created = page.waitForResponse(
    (r) => r.url().includes('/rpc/create_from_template') && r.ok(),
  );
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await created;
  await expect(page.getByRole('heading', { name: 'Reforma' })).toBeVisible();

  await page
    .getByRole('link', { name: /^Etapas/ })
    .last()
    .click();
  await expect(page.getByText('Aguardando: Definir o que vai ser feito')).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByRole('checkbox', { name: 'Concluir Pedir três orçamentos' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('checkbox', { name: 'Concluir Definir o que vai ser feito' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Voltar' }).click();

  await page
    .getByRole('link', { name: /^Orçamento/ })
    .last()
    .click();
  await expect(page.getByText(/R\$\s?15\.000,00/).first()).toBeVisible({ timeout: 15_000 });
});
