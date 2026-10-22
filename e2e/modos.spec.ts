import { expect, test, type Page } from '@playwright/test';

import { openTab, signUp } from './helpers';

/** Abre o seletor: botão da barra lateral no computador; no celular, pelo Mais (D258). */
async function openModes(page: Page, desktop: boolean) {
  if (desktop) await page.getByRole('button', { name: 'Modo: treino, foco ou descanso' }).click();
  else await openTab(page, 'Modo');
}

// U1 (D159): Treino, Foco e Descanso num seletor só.
test('modo: descanso e foco pelo seletor', async ({ page }, testInfo) => {
  const desktop = testInfo.project.name === 'desktop';
  await signUp(page, testInfo);
  await openModes(page, desktop);
  await expect(page.getByRole('heading', { name: 'Treino' })).toBeVisible();
  await expect(page.getByText(/^Nenhum treino ainda/)).toBeVisible();

  await page.getByRole('button', { name: '1:30' }).click();
  await expect(page.getByText('Descanso de 1:30 começou.')).toBeVisible();
  await expect(page.getByRole('timer', { name: /^Descanso: 1:[23]\d/ })).toBeVisible();

  if (!desktop)
    await page
      .getByRole('button', { name: 'Fechar' })
      .first()
      .click({ timeout: 3000 })
      .catch(() => {});
  await openModes(page, desktop);
  await page.getByRole('button', { name: 'Começar foco de 25 min' }).click();
  await expect(page).toHaveURL(/\/pomodoro/);
});

// W7: lista com séries também entra no Treino (no celular, o Modo fica no Mais, D258).
test('modo treino: página com séries aparece no seletor', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(`Supino ${Date.now()} 3x12`);
  await input.press('Enter');
  await page.waitForTimeout(1500);
  await openModes(page, testInfo.project.name === 'desktop');
  await page.getByRole('button', { name: 'Treinar: Caixa de entrada' }).click();
  await expect(page).toHaveURL(/\/treino\//);
});
