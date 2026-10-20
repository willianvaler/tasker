import { expect, test } from '@playwright/test';

import { openTab, signUp } from './helpers';

// AC2 (D234): o item de um treino mostra só o exercício; o resto fica em "Mais opções"
test('treino: painel do exercício sem ruído, Mais opções mostra o resto', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'O painel é o mesmo; basta um perfil');
  await signUp(page, testInfo);
  await openTab(page, 'Início');
  await page.getByRole('button', { name: 'Sim, vou treinar' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Novo treino' }).first().click();
  const name = `Treino ${Date.now()}`;
  await page.getByPlaceholder('Nome do treino (ex.: Treino A)').fill(name);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();

  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Supino 4x10 40kg');
  await input.press('Enter');
  await page.getByRole('button', { name: 'Detalhes de Supino' }).click();
  await expect(page.getByText('Exercício', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Etiquetas', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Prioridade', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^Mais opções/ }).click();
  await expect(page.getByText('Etiquetas', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Prioridade', { exact: true }).last()).toBeVisible();
});
