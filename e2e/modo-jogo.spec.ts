import { expect, test } from '@playwright/test';

import { openTab, signUp } from './helpers';

// HB3 e HB4 (ESCOPO_V8): três níveis de jogo no Perfil; no Completo o Início vira o acampamento.
test('modo jogo: Completo mostra o acampamento no Início', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Perfil');
  const level = page.getByRole('radiogroup', { name: 'Gamificação' });
  await expect(level.getByRole('radio', { name: 'Leve' })).toHaveAttribute('aria-checked', 'true');

  const saved = page.waitForResponse((r) => r.url().includes('/profiles') && r.ok());
  await level.getByRole('radio', { name: 'Completo' }).click();
  await saved;
  await openTab(page, 'Início');
  const camp = page.getByLabel('Acampamento');
  await expect(camp).toBeVisible();
  await expect(camp.getByRole('heading', { name: 'Teste' })).toBeVisible();
  await expect(camp.getByText('Bosses')).toBeVisible();
  // O boss tem uma fala (entre aspas)
  await expect(camp.getByText(/^“.+”$/).first()).toBeVisible();

  // Voltar ao Leve tira o acampamento
  await openTab(page, 'Perfil');
  const back = page.waitForResponse((r) => r.url().includes('/profiles') && r.ok());
  await level.getByRole('radio', { name: 'Leve' }).click();
  await back;
  await openTab(page, 'Início');
  await expect(page.getByLabel('Acampamento')).toHaveCount(0);
});
