import { expect, test } from '@playwright/test';

import { signUp } from './helpers';

// Fase C (V2 §5–9): estrutura e velocidade, de preferência sem mouse.

test('menu Novo: Alt+N abre, J cria um projeto, que aparece em Projetos', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Atalhos de teclado são do computador');
  await signUp(page, testInfo);
  await page.keyboard.press('Alt+n');
  await expect(page.getByRole('menuitem', { name: 'Projeto' })).toBeVisible();
  await page.keyboard.press('j');
  await page.getByPlaceholder('Nome (ex.: Churrasco do sábado)').fill('Mudança');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Mudança' })).toBeVisible();
  // Na barra lateral, dentro da seção Projetos
  await expect(page.getByRole('navigation').getByText('Projetos', { exact: true })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Mudança' })).toBeVisible();
});
