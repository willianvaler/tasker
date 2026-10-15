import { expect, test } from '@playwright/test';

import { isRpc, openTab, signUp } from './helpers';

test('tempo: cronômetro na tarefa, lançar à mão (ontem), apagar e Shift+T', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await page.clock.install();
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Planilha de custos');
  await input.press('Enter');
  await page.getByRole('button', { name: 'Detalhes de Planilha de custos' }).click();
  await expect(page.getByText('Feito: 0min')).toBeVisible();

  // Cronômetro: 10 minutos (o relógio da página é do teste)
  await page.getByRole('button', { name: 'Iniciar cronômetro' }).click();
  await expect(page.getByRole('button', { name: /^Parar cronômetro \(0:0\d\)$/ })).toBeVisible();
  await page.clock.fastForward('10:00');
  const stopped = page.waitForResponse((r) => isRpc(r, 'update_timer'));
  await page.getByRole('button', { name: /^Parar cronômetro \(10:0\d\)$/ }).click();
  await stopped;
  await expect(page.getByText('Feito: 10min')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel('10min · cronômetro · Hoje', { exact: true })).toBeVisible();

  // À mão, ontem
  const field = page.getByRole('textbox', { name: 'Lançar tempo' });
  await field.fill('45m ontem');
  await field.press('Enter');
  await expect(page.getByLabel('45min · lançado · Ontem', { exact: true })).toBeVisible();
  await expect(page.getByText('Feito: 55min')).toBeVisible();

  // Escrita errada avisa; apagar volta a soma
  await field.fill('muito tempo');
  await field.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: /^Escreva o tempo/ })).toBeVisible();
  await page.getByRole('button', { name: 'Apagar 45min · lançado · Ontem' }).click();
  await expect(page.getByLabel('45min · lançado · Ontem', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Feito: 10min')).toBeVisible();

  // Shift+T na lista liga o cronômetro da tarefa selecionada
  if (testInfo.project.name === 'celular') return;
  await page.getByRole('button', { name: 'Voltar' }).click();
  await page.locator('body').click({ position: { x: 600, y: 600 } });
  await page.keyboard.press('j');
  await page.keyboard.press('Shift+T');
  await expect(
    page.getByRole('timer', { name: /^Cronômetro · Planilha de custos: 0:0\d$/ }),
  ).toBeVisible();
});

test('tempo: números do pomodoro (hoje, 7 dias, onde foi o tempo)', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Revisar textos');
  await input.press('Enter');
  await page.getByRole('button', { name: 'Detalhes de Revisar textos' }).click();
  const logged = page.waitForResponse((r) => isRpc(r, 'log_time'));
  const field = page.getByRole('textbox', { name: 'Lançar tempo' });
  await field.fill('1h15');
  await field.press('Enter');
  await logged;

  await page.goto('/pomodoro');
  await expect(page.getByText('Hoje: 0 pomodoros · 1h15')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel('Hoje: 0 · 1h15', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Revisar textos: 1h15', { exact: true })).toBeVisible();
});
