import { expect, test } from '@playwright/test';

import { adminRest, signUp } from './helpers';

const userIdOf = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    return JSON.parse(localStorage.getItem(key ?? '') ?? '{}').user?.id as string;
  });

// V4 §1.4 (R1): renascer do nível 20 em diante, com confirmação por palavra
test('renascer: nível 21 volta ao 1, com o contador e o bônus', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'basta um perfil');
  await signUp(page, testInfo);
  const me = await userIdOf(page);
  await adminRest(`profiles?id=eq.${me}`, {
    method: 'PATCH',
    body: JSON.stringify({ class: 'lutador' }),
  });
  await page.goto('/character');
  // Abaixo do nível 20, o botão fica travado
  await expect(page.getByRole('button', { name: 'Renascer no nível 20' })).toBeDisabled({
    timeout: 20_000,
  });

  // 60.000 de XP antigos: nível 21, com 300 de ouro
  await adminRest('xp_events', {
    method: 'POST',
    body: JSON.stringify({
      user_id: me,
      kind: 'task',
      amount: 60000,
      gold: 300,
      day: new Date().toISOString().slice(0, 10),
      created_at: new Date(Date.now() - 86_400_000).toISOString(),
    }),
  });
  await page.reload();
  await page.getByRole('button', { name: 'Renascer', exact: true }).click();
  const confirm = page.getByRole('button', { name: 'Renascer', exact: true }).last();
  await page.getByPlaceholder('renascer').fill('renasce');
  await expect(confirm).toBeDisabled();
  await page.getByPlaceholder('renascer').fill('Renascer');
  await confirm.click();
  await expect(page.getByText(/Renasceu! 1× · \+5% de XP/)).toBeVisible();
  await expect(page.getByText('1× renascido · +5% de XP')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Renascer no nível 20' })).toBeVisible();
});
