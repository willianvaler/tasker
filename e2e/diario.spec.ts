import { expect, test } from '@playwright/test';

import { openTab, shown, signUp } from './helpers';

// AC4 (D236): o Modo Treino grava cada série como aconteceu (repetições reais, esforço,
// aquecimento à parte) e o painel do exercício mostra o histórico.
test('diário: série real, esforço e aquecimento no histórico', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'O Modo Treino é o mesmo; basta um perfil');
  await signUp(page, testInfo);
  await openTab(page, 'Início');
  await page.getByRole('button', { name: 'Sim, vou treinar' }).click();

  // Esforço por série ligado no Perfil (RPE)
  await openTab(page, 'Perfil');
  await page.getByRole('radio', { name: 'RPE' }).click();
  await expect(page.getByRole('radio', { name: 'RPE' })).toHaveAttribute('aria-checked', 'true');
  await openTab(page, 'Início');

  await page.getByRole('navigation').getByRole('button', { name: 'Novo treino' }).first().click();
  const name = `Treino ${Date.now()}`;
  await page.getByPlaceholder('Nome do treino (ex.: Treino A)').fill(name);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Supino 2x10 40kg');
  await input.press('Enter');
  await expect(page.getByRole('button', { name: 'Detalhes de Supino' })).toBeVisible();

  await page.getByRole('button', { name: 'Iniciar treino' }).click();
  await expect(page.getByRole('heading', { name: 'Supino' })).toBeVisible();

  // Aquecimento: fica no diário e não conta série
  await page.getByRole('button', { name: 'Aquecimento' }).click();
  await expect(shown(page, 'Aquecimento registrado')).toBeVisible();
  await expect(shown(page, 'Série 1 de 2')).toBeVisible();

  // Primeira série com uma repetição a menos e RPE 8
  await page.getByRole('button', { name: 'Menos uma repetição' }).click();
  await expect(page.getByLabel('Repetições feitas: 9')).toBeVisible();
  await page.getByRole('radio', { name: '8', exact: true }).click();
  await page.getByRole('button', { name: 'Feita' }).click();
  await expect(shown(page, 'Série 2 de 2')).toBeVisible();
  // A próxima série volta ao previsto
  await expect(page.getByLabel('Repetições feitas: 10')).toBeVisible();
  await page.getByRole('button', { name: 'Feita' }).click();

  await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Detalhes de Supino' }).click();
  await expect(shown(page, /2 séries · Volume 760 kg/)).toBeVisible({ timeout: 15_000 });
  await expect(shown(page, '40 kg × 9 · RPE 8')).toBeVisible();
  await expect(shown(page, /^40 kg × 10$/)).toBeVisible();
  await expect(shown(page, /40 kg × 10 · aquecimento/)).toBeVisible();

  // Apagar uma série do diário
  await page.getByRole('button', { name: 'Apagar série' }).first().click();
  await page.getByRole('button', { name: 'Apagar série' }).last().click();
  await expect(shown(page, /40 kg × 10 · aquecimento/)).toHaveCount(0);
});

// AC5 (D237): série mais pesada que as anteriores avisa o recorde; o resumo conta e o painel
// mostra os melhores, com o 1RM e de que série ele veio
test('recorde no Modo Treino, no resumo e no painel', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'O Modo Treino é o mesmo; basta um perfil');
  await signUp(page, testInfo);
  await openTab(page, 'Início');
  await page.getByRole('button', { name: 'Sim, vou treinar' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Novo treino' }).first().click();
  const name = `Treino ${Date.now()}`;
  await page.getByPlaceholder('Nome do treino (ex.: Treino A)').fill(name);
  await page.getByRole('button', { name: 'Salvar' }).click();
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Agachamento 2x10 40kg');
  await input.press('Enter');
  await expect(page.getByRole('button', { name: 'Detalhes de Agachamento' })).toBeVisible();

  await page.getByRole('button', { name: 'Iniciar treino' }).click();
  // A primeira série é o ponto de partida: sem recorde
  await page.getByRole('button', { name: 'Feita' }).click();
  await expect(shown(page, 'Série 2 de 2')).toBeVisible();
  await expect(shown(page, /^Recorde!/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Aumentar a carga' }).click();
  await expect(page.getByLabel('Carga: 42,5kg')).toBeVisible();
  // Última série: o aviso do recorde dá lugar ao resumo do treino, que conta o recorde
  await page.getByRole('button', { name: 'Feita' }).click();
  await expect(shown(page, /Treino concluído · .*1 recorde/)).toBeVisible();

  await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Detalhes de Agachamento' }).click();
  await expect(shown(page, 'Maior 1RM estimado', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(shown(page, /pela série 42,5 kg × 10/)).toBeVisible();
});
