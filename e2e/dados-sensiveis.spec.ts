import { expect, test } from '@playwright/test';

import { openSettings, signUp } from './helpers';

// SA0 (D382): saúde, local, câmera e dispositivo só saem num webhook se a pessoa liberar o campo
test('dado sensível: liberar e bloquear de novo um campo para as automações', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  await openSettings(page);
  await expect(page.getByText('Dados sensíveis em automações')).toBeVisible();
  await expect(page.getByText('Nenhum campo liberado.')).toBeVisible();

  const field = page.getByRole('textbox', { name: 'Campo sensível para liberar' });
  // Campo que não é sensível é recusado pelo servidor
  await field.fill('usuario.nivel');
  await page.getByRole('button', { name: 'Liberar campo' }).click();
  await expect(page.getByText(/Campo sensível inválido/)).toBeVisible();

  // O apelido em inglês vira o nome canônico
  await field.fill('health.water.ml');
  await page.getByRole('button', { name: 'Liberar campo' }).click();
  await expect(page.getByText('saude.water.ml', { exact: true })).toBeVisible();
  await expect(field).toHaveValue('');

  await page.getByRole('button', { name: 'Bloquear de novo saude.water.ml' }).click();
  await expect(page.getByText('Nenhum campo liberado.')).toBeVisible();
});
