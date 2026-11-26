import { expect, test } from '@playwright/test';

import { openTab, shown, signUp, waitForSync } from './helpers';

// SA4 (D389): exames no Bem-estar, depois do consentimento da saúde. Registrar, repetir o exame
// (nome, unidade e faixa vêm do último), gráfico, editar, recarregar e apagar. Sem interpretação.
test('exames: resultado, gráfico, edição e apagar', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await waitForSync(page);
  await openTab(page, 'Bem-estar');
  await page
    .getByRole('button', { name: 'Concordo em guardar meus dados de saúde' })
    .first()
    .click();
  await page.getByRole('link', { name: /Exames/ }).click();
  await expect(shown(page, 'não é dispositivo médico', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Novo exame' }).click();
  await page.getByRole('textbox', { name: 'Exame (ex.: Glicose)' }).fill('Glicose');
  await page.getByRole('textbox', { name: 'Valor' }).fill('92');
  await page.getByRole('textbox', { name: 'Unidade' }).fill('mg/dL');
  await page.getByRole('textbox', { name: 'Data (dd/mm/aaaa)' }).fill('10/05/2026');
  await page.getByRole('textbox', { name: 'Mínimo' }).fill('70');
  await page.getByRole('textbox', { name: 'Máximo' }).fill('99');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(
    shown(page, 'Último: 92 mg/dL em 10/05/2026 · faixa digitada: 70–99 mg/dL'),
  ).toBeVisible();

  // O segundo resultado já vem com a unidade e a faixa
  await page.getByRole('button', { name: 'Novo resultado de Glicose' }).click();
  await expect(page.getByRole('textbox', { name: 'Unidade' })).toHaveValue('mg/dL');
  await page.getByRole('textbox', { name: 'Valor' }).fill('1o5');
  await expect(shown(page, 'Use só números (ex.: 5,4).')).toBeVisible();
  await page.getByRole('textbox', { name: 'Valor' }).fill('105,5');
  await page.getByRole('textbox', { name: 'Data (dd/mm/aaaa)' }).fill('10/09/2026');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Gráfico de Glicose: 2 resultados' })).toBeVisible();
  // Fora da faixa digitada e nenhuma palavra de julgamento
  await expect(shown(page, 'Último: 105,5 mg/dL em 10/09/2026', { exact: false })).toBeVisible();
  await expect(page.getByText(/alto|elevado|anormal/i)).toHaveCount(0);

  await page.getByRole('button', { name: 'Editar o resultado de 10/09/2026' }).click();
  await page.getByRole('textbox', { name: 'Valor' }).fill('97');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(shown(page, 'Último: 97 mg/dL em 10/09/2026', { exact: false })).toBeVisible();

  await waitForSync(page);
  await page.reload();
  await expect(shown(page, 'Último: 97 mg/dL em 10/09/2026', { exact: false })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Apagar o resultado de 10/09/2026' }).click();
  await page.getByRole('button', { name: 'Apagar', exact: true }).click();
  await expect(shown(page, 'Último: 92 mg/dL em 10/05/2026', { exact: false })).toBeVisible();
  await expect(page.getByRole('img', { name: /Gráfico de Glicose/ })).toHaveCount(0);
});
