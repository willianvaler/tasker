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
  const context = await browser.newContext({ ...testInfo.project.use, locale: 'es-AR' });
  const page = await context.newPage();
  // Cadastro à mão: o signUp() navega pelos rótulos em português
  await page.goto('/');
  await page.getByText('Não tenho conta').click();
  await page.getByPlaceholder('Seu nome').fill('Teste E2E');
  await page
    .getByPlaceholder('E-mail')
    .fill(`e2e-es-${Date.now()}-${testInfo.project.name}@teste.local`);
  await page.getByPlaceholder('Senha').fill('senha-forte-123');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.getByRole('button', { name: 'Pular introdução' }).click();
  // A navegação já está traduzida: aba (celular) ou link da barra lateral (computador)
  await expect(
    page
      .getByRole('tab', { name: 'Hoy' })
      .or(page.getByRole('navigation').getByRole('link', { name: 'Hoy' })),
  ).toBeVisible();
  await context.close();
});
