import { expect, test } from '@playwright/test';

import { createPage, signUp } from './helpers';

test('menu Novo: pelo botão cabe na janela; pelo Alt+N abre no meio', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'No celular o menu é uma folha de baixo');
  await signUp(page, testInfo);
  await page.getByRole('button', { name: /^Novo/ }).last().click();
  const last = page.getByRole('menuitem', { name: /Criação avançada/ });
  await expect(last).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('menuitem', { name: /^Tarefa/ })).toBeInViewport({ ratio: 1 });
  await page.keyboard.press('Escape');
  await expect(last).toHaveCount(0);

  await page.locator('body').click({ position: { x: 600, y: 600 } });
  await page.keyboard.press('Alt+n');
  await expect(last).toBeVisible();
  const box = (await page.getByRole('menuitem', { name: /^Tarefa/ }).boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(40);
  expect(box.y).toBeGreaterThan(viewport.height / 5);
});

test('Alt+N → T cria na tela atual, não na última página visitada', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Atalho de teclado');
  await signUp(page, testInfo);
  const pageId = await createPage(page, { folder: 'Academia', name: 'Treino D', type: 'Lista' });

  // Na página aberta, o destino é ela
  await page.locator('body').click({ position: { x: 600, y: 600 } });
  await page.keyboard.press('Alt+n');
  await page.keyboard.press('t');
  await expect(page.getByRole('radio', { name: /Treino D/, checked: true })).toBeVisible();
  await page.keyboard.press('Escape');

  // De volta ao Início, o destino é a Caixa de entrada
  await page.goto('/');
  await expect(page).not.toHaveURL(new RegExp(pageId));
  await page.locator('body').click({ position: { x: 600, y: 600 } });
  await page.keyboard.press('Alt+n');
  await page.keyboard.press('t');
  await expect(page.getByRole('radio', { name: /Caixa de entrada/, checked: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Treino D/, checked: false })).toBeVisible();
});
