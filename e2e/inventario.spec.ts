import { expect, test } from '@playwright/test';

import { adminRest, signUp } from './helpers';

// V4 §3 (Q1, D181): inventário com filtros por raridade e origem, e equipar dali.
test('inventário: itens da loja e de boss, filtros e equipar', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  const userId = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    return JSON.parse(localStorage.getItem(key ?? '') ?? '{}').user?.id as string;
  });
  expect(userId).toBeTruthy();
  // Um da loja (incomum) e um que caiu de boss (lendário)
  await adminRest('user_items', {
    method: 'POST',
    body: JSON.stringify([
      { user_id: userId, item_key: 'helmet', source: 'shop' },
      { user_id: userId, item_key: 'crown', source: 'drop' },
    ]),
  });

  await page.goto('/inventario');
  const helmet = page.getByLabel('Elmo, Cabeça, Incomum', { exact: true });
  const crown = page.getByLabel('Coroa, Cabeça, Lendário', { exact: true });
  await expect(helmet).toBeVisible({ timeout: 15_000 });
  await expect(crown).toBeVisible();
  await expect(crown.getByText(/^Ganho de um boss em/)).toBeVisible();

  // Só o que caiu de boss
  await page.getByRole('button', { name: 'De boss', exact: true }).click();
  await expect(helmet).toHaveCount(0);
  await expect(crown).toBeVisible();

  // Equipar a coroa
  await page.getByRole('button', { name: 'Equipar: Coroa' }).click();
  await expect(page.getByRole('button', { name: 'Equipado: Coroa' })).toBeVisible();
  await expect
    .poll(
      async () => (await adminRest(`profiles?id=eq.${userId}&select=equipped`))[0]?.equipped?.head,
      {
        timeout: 15_000,
      },
    )
    .toBe('crown');
});
