import { expect, test } from '@playwright/test';

import { openTab, signUp } from './helpers';

// W2: Projetos sempre à vista com "+", e a tela de configurações de projetos (com os times).
test('projetos: criar pelo bloco fixo e configurar pelo Perfil', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  const name = `Obra ${testInfo.project.name} ${Date.now()}`;
  if (testInfo.project.name === 'desktop') {
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'Criar o primeiro projeto' })
      .click();
  } else {
    await openTab(page, 'Pastas');
    await page.getByRole('button', { name: 'Criar o primeiro projeto' }).click();
  }
  await page.getByPlaceholder('Nome (ex.: Churrasco do sábado)').fill(name);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name })).toBeVisible();

  await page.goto('/profile');
  await page.getByRole('button', { name: 'Configurações de projetos' }).click();
  await expect(page.getByRole('heading', { name: 'Configurações de projetos' })).toBeVisible();
  await expect(page.getByRole('link', { name: `Abrir o projeto ${name}` })).toBeVisible();
  await page.getByRole('button', { name: 'Pessoas e convites' }).click();
  await expect(page).toHaveURL(/\/share\//);
});
