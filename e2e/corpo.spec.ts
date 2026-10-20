import { expect, test } from '@playwright/test';

import { openTab, shown, signUp } from './helpers';

// AC7 (D239): peso e medidas são dado sensível: o consentimento vem antes; depois, registro,
// meta, direção e "parar e apagar tudo"
test('peso e medidas: consentimento, registro, meta e revogar', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Tela igual; basta um perfil');
  await signUp(page, testInfo);
  await openTab(page, 'Início');
  await page.getByRole('button', { name: 'Sim, vou treinar' }).click();
  await page.goto('/corpo');

  await expect(shown(page, 'Antes de começar')).toBeVisible();
  await page.getByRole('button', { name: 'Concordo e quero registrar' }).click();

  const value = page.getByRole('textbox', { name: 'Valor (kg)' });
  const date = page.getByRole('textbox', { name: 'Data (AAAA-MM-DD)' });
  await value.fill('80');
  await date.fill('2026-10-01');
  await page.getByRole('button', { name: 'Registrar' }).click();
  await value.fill('79,2');
  await date.fill('2026-10-08');
  await page.getByRole('button', { name: 'Registrar' }).click();
  await expect(shown(page, /^Último: 79,2 kg/)).toBeVisible();

  await page.getByRole('textbox', { name: 'Meta (kg)' }).fill('75');
  await page.getByRole('button', { name: 'Salvar meta' }).click();
  await expect(shown(page, 'Faltam 4,2 kg para a meta · Aproximou da meta')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Gráfico de Peso · Meta: 75 kg' })).toBeVisible();

  // Medidas têm a própria lista
  await page.getByRole('radio', { name: 'Cintura' }).click();
  await expect(shown(page, 'Nenhum registro ainda.')).toBeVisible();

  // Recarregar mantém (o banco guardou)
  await page.reload();
  await expect(shown(page, /^Último: 79,2 kg/)).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Parar de guardar e apagar tudo' }).click();
  await page.getByRole('button', { name: 'Parar e apagar' }).click();
  await expect(shown(page, 'Antes de começar')).toBeVisible();
  await page.reload();
  await expect(shown(page, 'Antes de começar')).toBeVisible({ timeout: 15_000 });
});
