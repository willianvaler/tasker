import { expect, test } from '@playwright/test';

import { openTab, shown, signUp } from './helpers';

// ESCOPO_V15 (CS1): equipamento, manutenção a cada 90 dias depois do último feito, a tarefa na
// Caixa de entrada e o "Feito" que agenda a próxima a partir de hoje.
test('casa: equipamento, manutenção, tarefa na Caixa de entrada e feito', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await signUp(page, testInfo);
  await page.goto('/casa');
  await expect(page.getByRole('heading', { name: 'Casa' })).toBeVisible();

  await page.getByRole('button', { name: 'Novo equipamento' }).first().click();
  await page.getByLabel('Nome', { exact: true }).fill('Ar do quarto');
  await page.getByLabel('Cômodo').fill('Quarto');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Ar do quarto', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Manutenção de Ar do quarto' }).click();
  await page.getByLabel('O que fazer').fill('Limpar o filtro');
  await page.getByLabel('A cada', { exact: true }).fill('90');
  await page.getByRole('radio', { name: 'dias' }).click();
  await page.getByLabel('Feito pela última vez').fill('2026-01-01');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText(/Atrasada desde/)).toBeVisible();

  // A tarefa do plano está na Caixa de entrada
  await openTab(page, 'Caixa de entrada');
  await expect(shown(page, 'Limpar o filtro · Ar do quarto')).toBeVisible();

  // Feito na tela Casa: a próxima conta de hoje (não está mais atrasada)
  await page.goto('/casa');
  await page.getByRole('button', { name: 'Marcar Limpar o filtro como feito' }).click();
  await expect(page.getByText(/feito\. A próxima já está agendada/)).toBeVisible();
  await expect(page.getByText(/Atrasada desde/)).toHaveCount(0);
  await expect(page.getByText(/Próxima:/)).toBeVisible();
});
