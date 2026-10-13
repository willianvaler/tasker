import { expect, test } from '@playwright/test';

import { openTab, signUp } from './helpers';

test('idioma: escolher no Perfil vale na hora e continua depois de recarregar', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Perfil');
  await expect(page.getByText('Idioma', { exact: true })).toBeVisible();

  const saved = page.waitForResponse(
    (r) => r.url().includes('/profiles') && r.request().method() === 'PATCH',
  );
  await page.getByRole('radio', { name: 'English' }).click();
  await expect(page.getByText('Language', { exact: true })).toBeVisible();
  await saved;

  await page.reload();
  await expect(page.getByText('Language', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'English' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('idioma: o do navegador vale para conta nova', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ locale: 'es-AR' });
  const page = await context.newPage();
  await signUp(page, testInfo);
  await openTab(page, 'Perfil');
  await expect(page.getByText('Idioma', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Idioma del dispositivo' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await context.close();
});
