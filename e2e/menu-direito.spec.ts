import { expect, test } from '@playwright/test';

import { createPage, signUp } from './helpers';

// Clique direito numa linha com "…" abre o mesmo menu (e não o do navegador)
test('clique direito na pasta da barra lateral abre o menu dela', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Mouse e barra lateral só no desktop');
  await signUp(page, testInfo);
  const folder = `Pasta ${Date.now()}`;
  await createPage(page, { folder, name: 'Lista do clique', type: 'Lista' });
  await page.getByRole('navigation').getByRole('link', { name: folder }).click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Renomear' })).toBeVisible();
});
