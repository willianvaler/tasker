import { expect, test } from '@playwright/test';

import { signUp } from './helpers';

// Divisor entre os atalhos fixos e os blocos da barra lateral (pedido do dono, 03/11): arrastar
// para cima encolhe os atalhos, a escolha fica ao recarregar e o duplo clique mostra todos.
test('barra lateral: divisor dos atalhos e dos blocos', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'a barra lateral é do computador');
  await signUp(page, testInfo);
  const split = page.getByRole('separator', { name: /Altura dos atalhos/ });
  await expect(split).toBeVisible();
  const full = Number(await split.getAttribute('aria-valuenow'));
  expect(full).toBeGreaterThan(200);

  const box = (await split.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 150, { steps: 8 });
  await page.mouse.up();
  const shrunk = Number(await split.getAttribute('aria-valuenow'));
  expect(shrunk).toBeLessThan(full - 100);
  // Os blocos sobem junto
  const notes = page.getByRole('navigation').getByText('Anotações', { exact: true });
  const top = (await notes.boundingBox())!.y;

  await page.reload();
  await expect(split).toHaveAttribute('aria-valuenow', String(shrunk));
  expect(Math.abs((await notes.boundingBox())!.y - top)).toBeLessThan(4);

  // Teclado e duplo clique
  await split.focus();
  await page.keyboard.press('ArrowDown');
  await expect(split).toHaveAttribute('aria-valuenow', String(shrunk + 16));
  await split.dblclick();
  await expect(split).toHaveAttribute('aria-valuenow', String(full));
});
