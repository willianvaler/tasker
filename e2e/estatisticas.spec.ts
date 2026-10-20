import { expect, test } from '@playwright/test';

import { openTab, shown, signUp } from './helpers';

// AC8 (D240): as estatísticas saem do diário: dias e tempo, mapa muscular pelo exercício ligado
// (com os que ficaram sem treino), volume por semana
test('estatísticas de treino: dia, mapa muscular e volume', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Tela igual; basta um perfil');
  test.setTimeout(60_000);
  await signUp(page, testInfo);
  await openTab(page, 'Início');
  await page.getByRole('button', { name: 'Sim, vou treinar' }).click();

  await page.goto('/treino-estatisticas');
  await expect(shown(page, /^Nenhuma série no diário ainda/)).toBeVisible({ timeout: 15_000 });

  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Novo treino' }).first().click();
  const name = `Treino ${Date.now()}`;
  await page.getByPlaceholder('Nome do treino (ex.: Treino A)').fill(name);
  await page.getByRole('button', { name: 'Salvar' }).click();
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Supino reto com barra 1x10 40kg');
  await input.press('Enter');
  await page.getByRole('button', { name: /^Detalhes de Supino/ }).click();
  await expect(page.getByText(/^Parece /)).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Ligar', exact: true }).click();
  await expect(page.getByText(/^Exercício: /)).toBeVisible();
  await page.goBack();

  await page.getByRole('button', { name: 'Iniciar treino' }).click();
  await page.getByRole('button', { name: 'Feita' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 });

  await page.goto('/treino-estatisticas');
  await expect(shown(page, /^1 dia de treino · /)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('img', { name: /^Mapa muscular\. Trabalhados: .*Peito/ })).toBeVisible();
  await expect(shown(page, /^Sem treino no período: .*Quadríceps/)).toBeVisible();
  await expect(page.getByLabel(/^\d{4}-W\d{2}: 400 kg, 1 série$/)).toBeVisible();
});
