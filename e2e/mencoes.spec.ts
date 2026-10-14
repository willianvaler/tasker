import { expect, test } from '@playwright/test';

import { openTab, signUp } from './helpers';

test('@nome com autocomplete na captura de uma lista de projeto', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Pastas');
  await page.getByRole('button', { name: 'Usar modelo' }).click();
  await page.getByRole('button', { name: 'Modelo Churrasco' }).click();
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await page.getByRole('link', { name: 'Compras' }).last().click();

  const field = page.getByRole('textbox', { name: 'Nova tarefa' });
  await field.click();
  await field.pressSequentially('Farofa @Tes');
  const option = page.getByRole('button', { name: 'Atribuir a Teste E2E' });
  await expect(option).toBeVisible();
  await expect(option).toHaveAttribute('aria-selected', 'true');
  // Enter com a lista aberta escolhe; o segundo Enter cria
  await field.press('Enter');
  await expect(field).toHaveValue('Farofa @Teste ');
  await expect(option).toHaveCount(0);
  await field.press('Enter');
  await expect(page.getByRole('checkbox', { name: 'Concluir Farofa', exact: true })).toBeVisible();
  await expect(page.getByLabel('Responsáveis: Teste E2E').first()).toBeVisible();

  // Esc fecha a lista sem mexer no texto
  await field.pressSequentially('Gelo @T');
  await expect(option).toBeVisible();
  await field.press('Escape');
  await expect(option).toHaveCount(0);
  await expect(field).toHaveValue('Gelo @T');
});
