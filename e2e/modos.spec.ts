import { expect, test } from '@playwright/test';

import { signUp } from './helpers';

// U1 (D159): Treino, Foco e Descanso num seletor só.
test('modo: descanso e foco pelo seletor', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  // Celular: ícone no topo da Hoje; computador: botão da barra lateral
  await page.getByRole('button', { name: 'Modo: treino, foco ou descanso' }).first().click();
  await expect(
    page
      .getByRole('header', { name: 'Treino' })
      .or(page.getByText('Treino', { exact: true }))
      .first(),
  ).toBeVisible();
  await expect(page.getByText(/^Nenhuma página de treino ainda/)).toBeVisible();

  await page.getByRole('button', { name: '1:30' }).click();
  await expect(page.getByText('Descanso de 1:30 começou.')).toBeVisible();
  await expect(page.getByRole('timer', { name: /^Descanso: 1:[23]\d/ })).toBeVisible();

  await page.getByRole('button', { name: 'Modo: treino, foco ou descanso' }).first().click();
  await page.getByRole('button', { name: 'Começar foco de 25 min' }).click();
  await expect(page).toHaveURL(/\/pomodoro/);
});
