import { expect, test } from '@playwright/test';

import { signUp } from './helpers';

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
