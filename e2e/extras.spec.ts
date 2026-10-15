import { expect, test } from '@playwright/test';

import { openTab, shown, signUp } from './helpers';

test('adiar: um toque leva para amanhã (sai da Hoje), Desfazer volta; Z na selecionada', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Pagar boleto hoje');
  await input.press('Enter');
  await input.fill('Ligar para o banco hoje');
  await input.press('Enter');

  await page.getByRole('button', { name: 'Adiar Pagar boleto para amanhã' }).click();
  const toast = page.getByRole('alert').filter({ hasText: 'Pagar boleto: adiada para Amanhã' });
  await expect(toast).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Concluir Pagar boleto' })).toHaveCount(0);
  await toast.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByRole('checkbox', { name: 'Concluir Pagar boleto' })).toBeVisible();

  if (testInfo.project.name === 'celular') return;
  await page.locator('body').click({ position: { x: 600, y: 600 } });
  await page.keyboard.press('j');
  await page.keyboard.press('z');
  await expect(page.getByRole('alert').filter({ hasText: /: adiada para Amanhã/ })).toBeVisible();
  await openTab(page, 'Início');
  await expect(shown(page, 'Próximos 7 dias').first()).toBeVisible();
});
