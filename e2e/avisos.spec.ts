import { expect, test } from '@playwright/test';

import { openTab, shown, signUp } from './helpers';

// U5 (D156): o Perfil mostra a permissão de notificação e deixa testar o aviso.
test('Perfil: permissão de notificação e testar o aviso', async ({ page, context }, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Perfil');
  await expect(shown(page, 'Avisos do timer')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Testar aviso' })).toBeVisible();
  await context.grantPermissions(['notifications']);
  await page.reload();
  await openTab(page, 'Perfil');
  // O texto segue o que o navegador diz (o Chromium sem tela pode continuar dizendo "bloqueado")
  const permission = await page.evaluate(() => Notification.permission);
  const expected = { granted: /^Permitido/, denied: /^Bloqueado/, default: /^Ainda não/ }[permission];
  await expect(shown(page, expected)).toBeVisible();
  await page.getByRole('button', { name: 'Testar aviso' }).click();
  await expect(page.getByRole('button', { name: 'Permitir notificações' })).toHaveCount(0);
});
