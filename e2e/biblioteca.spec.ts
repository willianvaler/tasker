import { expect, test } from '@playwright/test';

import { adminRest, openTab, shown, signUp } from './helpers';

// AC3 (D235): biblioteca com busca e ficha; o item de treino sugere o exercício e liga
test('biblioteca: busca, ficha e o item de treino ligado ao exercício', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Telas iguais; basta um perfil');
  test.setTimeout(60_000);
  await signUp(page, testInfo);
  await openTab(page, 'Início');
  await page.getByRole('button', { name: 'Sim, vou treinar' }).click();

  await page.goto('/biblioteca');
  // O nome em inglês também acha (sinônimos e os três idiomas)
  await page.getByRole('textbox', { name: /^Buscar exercício/ }).fill('bench press');
  const first = page.getByRole('button', { name: /^Supino/ }).first();
  await expect(first).toBeVisible({ timeout: 15_000 });
  await first.click();
  await expect(page.getByText('Como fazer', { exact: true }).last()).toBeVisible();
  await expect(shown(page, 'Peitoral', { exact: true }).first()).toBeVisible();

  // Treino novo: o item "Supino" sugere o exercício e liga
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Novo treino' }).first().click();
  const name = `Treino ${Date.now()}`;
  await page.getByPlaceholder('Nome do treino (ex.: Treino A)').fill(name);
  await page.getByRole('button', { name: 'Salvar' }).click();
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Supino reto com barra 4x10 40kg');
  await input.press('Enter');
  await page.getByRole('button', { name: /^Detalhes de Supino/ }).click();
  await expect(page.getByText(/^Parece /)).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Ligar', exact: true }).click();
  await expect(page.getByText(/^Exercício: /)).toBeVisible();
  await expect
    .poll(
      async () =>
        (await adminRest(`tasks?title=like.Supino*&exercise_id=not.is.null&select=exercise_id`))
          .length,
      { timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(1);

  // Direto da biblioteca: o item já nasce ligado, sem abrir os detalhes
  await page.goBack();
  await page.getByRole('button', { name: 'Adicionar exercício da biblioteca' }).click();
  await page
    .getByRole('textbox', { name: /^Buscar exercício/ })
    .last()
    .fill('agachamento');
  const squat = page.getByRole('button', { name: /^Agachamento/ }).first();
  await expect(squat).toBeVisible({ timeout: 15_000 });
  await squat.click();
  await expect(page.getByText(/entrou no treino\.$/)).toBeVisible();
  await expect
    .poll(
      async () =>
        (await adminRest(`tasks?title=like.Agachamento*&exercise_id=not.is.null&select=id`)).length,
      { timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(1);
});
