import { expect, test } from '@playwright/test';

import { openTab, signUp, waitForSync } from './helpers';

// SA1 (D384): sono no Bem-estar, depois do consentimento da saúde; a noite passa da meia-noite
test('sono: registrar a noite, a meta e apagar', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await waitForSync(page);
  await openTab(page, 'Bem-estar');
  await page
    .getByRole('button', { name: 'Concordo em guardar meus dados de saúde' })
    .first()
    .click();
  await expect(page.getByText('Nenhuma noite registrada nesta semana.')).toBeVisible();

  await page.getByRole('button', { name: 'Registrar sono' }).click();
  await page.getByPlaceholder('Dormi às (ex.: 23:30)').fill('23:30');
  await page.getByPlaceholder('Acordei às (ex.: 7h)').fill('7h');
  await page.getByRole('button', { name: 'Registrar', exact: true }).click();
  await expect(page.getByText('Última noite: 7 h 30 min (meta 8 h)')).toBeVisible();
  await expect(page.getByText('23:30 → 07:00 · 7 h 30 min')).toBeVisible();

  await page.getByRole('button', { name: 'Meta de sono' }).click();
  await page.getByPlaceholder('Horas por noite').fill('7,5');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Última noite: 7 h 30 min (meta 7 h 30 min)')).toBeVisible();

  await waitForSync(page);
  await page.reload();
  await expect(page.getByText('23:30 → 07:00 · 7 h 30 min')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Apagar o sono das 23:30' }).click();
  await expect(page.getByText('Nenhuma noite registrada nesta semana.')).toBeVisible();
});
