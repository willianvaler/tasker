import { expect, test } from '@playwright/test';

import { openTab, signUp, waitForSync } from './helpers';

// SA2 (D383): água no Bem-estar, só depois do consentimento da saúde; toques rápidos, outra
// quantidade, meta e o modelo de lembrete nas automações
test('água: consentimento, copo, outra quantidade, meta e lembrete', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await waitForSync(page);
  await openTab(page, 'Bem-estar');
  await expect(page.getByText('Dados de saúde', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Concordo em guardar meus dados de saúde' }).click();

  await page.getByRole('button', { name: '+ 1 copo (250 mL)' }).click();
  await expect(page.getByText('250 mL de 2 L')).toBeVisible();
  await expect(page.getByText('Faltam 1,8 L para a meta.')).toBeVisible();

  await page.getByRole('button', { name: 'Outra quantidade' }).click();
  await page.getByPlaceholder('Ex.: 300 ml ou 0,5 l').fill('0,5 l');
  await page.getByRole('button', { name: 'Registrar', exact: true }).click();
  await expect(page.getByText('750 mL de 2 L')).toBeVisible();

  // Apagar um registro
  await page.getByRole('button', { name: 'Apagar o registro de 250 mL' }).click();
  await expect(page.getByText('500 mL de 2 L')).toBeVisible();

  // Meta menor: bate a meta
  await page.getByRole('button', { name: 'Meta e copo' }).click();
  await page.getByPlaceholder('Meta do dia em mL').fill('500');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Meta de hoje batida.')).toBeVisible();
  await expect(page.getByText(/não é dispositivo médico/)).toBeVisible();

  // Continua depois de recarregar (gravado no servidor ou no aparelho)
  await waitForSync(page);
  await page.reload();
  await expect(page.getByText('500 mL de 500 mL')).toBeVisible({ timeout: 15_000 });

  // O lembrete é um modelo das automações
  await page.getByRole('button', { name: 'Lembrete de beber água (Automações)' }).click();
  await expect(page.getByText('Lembrar de beber água').first()).toBeVisible();
});
