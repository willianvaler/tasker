import { expect, test } from '@playwright/test';

import { openTab, signUp } from './helpers';

// U1 (D159): Treino, Foco e Descanso num seletor só.
test('modo: descanso e foco pelo seletor', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  // Celular: ícone no topo da Hoje; computador: botão da barra lateral
  await page.getByRole('button', { name: 'Modo: treino, foco ou descanso' }).first().click();
  await expect(page.getByRole('heading', { name: 'Treino' })).toBeVisible();
  await expect(page.getByText(/^Nenhuma página de treino ainda/)).toBeVisible();

  await page.getByRole('button', { name: '1:30' }).click();
  await expect(page.getByText('Descanso de 1:30 começou.')).toBeVisible();
  await expect(page.getByRole('timer', { name: /^Descanso: 1:[23]\d/ })).toBeVisible();

  await page.getByRole('button', { name: 'Modo: treino, foco ou descanso' }).first().click();
  await page.getByRole('button', { name: 'Começar foco de 25 min' }).click();
  await expect(page).toHaveURL(/\/pomodoro/);
});

// W7: página de lista com séries também entra no Treino, e o celular tem "⚡ Modo" com texto.
test('modo treino: página com séries aparece no seletor', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(`Supino ${Date.now()} 3x12`);
  await input.press('Enter');
  await page.waitForTimeout(1500);
  await openTab(page, 'Hoje');
  const modeButton = page.getByRole('button', { name: 'Modo: treino, foco ou descanso' }).first();
  if (testInfo.project.name !== 'desktop') await expect(modeButton).toContainText('Modo');
  await modeButton.click();
  await page.getByRole('button', { name: 'Treinar: Caixa de entrada' }).click();
  await expect(page).toHaveURL(/\/treino\//);
});
