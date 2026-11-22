import { expect, test } from '@playwright/test';

import { openTab, signUp } from './helpers';

// ES4 (ESCOPO_V13 §3, D325): material da pasta. Adicionar PDF + .md (com a imagem que ele cita);
// o que não entra fica de fora; o PDF abre no leitor do navegador; tirar leva para a lixeira.
const PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
trailer<</Root 1 0 R>>
%%EOF`;
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test('material: adicionar PDF e .md, ler o PDF e tirar', async ({ page }, testInfo) => {
  const stamp = `${testInfo.project.name}${Date.now()}`;
  const folder = `Estudo ${stamp}`;
  await signUp(page, testInfo);
  await openTab(page, 'Pastas');
  await page.getByRole('button', { name: 'Nova pasta' }).last().click();
  await page.getByPlaceholder('Nome (ex.: Academia)').fill(folder);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { name: folder })).toBeVisible();

  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Adicionar material' }).click();
  await (
    await chooser
  ).setFiles([
    { name: '03 - M01 - Assis.pdf', mimeType: 'application/pdf', buffer: Buffer.from(PDF) },
    {
      name: '04 - M01 - Equilíbrio.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# Equilíbrio\n\n![porta](img/porta.png)\n\nTorque $\\tau = rF$.'),
    },
    { name: 'porta.png', mimeType: 'image/png', buffer: PNG },
    { name: '05 - PhET.html', mimeType: 'text/html', buffer: Buffer.from('<html></html>') },
  ]);
  await expect(page.getByText(/2 materiais adicionados\. 1 arquivo ficou de fora/)).toBeVisible({
    timeout: 60_000,
  });

  // A lista do material, na ordem do nome
  const section = page.getByTestId('materials');
  await expect(section.getByRole('link')).toHaveText([/03 - M01 - Assis/, /04 - M01 - Equilíbrio/]);
  await expect(section.getByText(/^PDF · /)).toBeVisible();

  // O .md virou anotação da pasta, com a imagem
  await section.getByRole('link', { name: '04 - M01 - Equilíbrio' }).click();
  await expect(page.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue(
    '04 - M01 - Equilíbrio',
  );
  await page.goBack();

  // O PDF abre no leitor do navegador, num quadro com o arquivo em blob:
  await section.getByRole('link', { name: '03 - M01 - Assis' }).click();
  await expect(page.getByRole('heading', { name: '03 - M01 - Assis' })).toBeVisible();
  await expect(page.getByTestId('pdf-frame')).toHaveAttribute('src', /^blob:/);
  await page.goBack();

  // Tirar: vai para a lixeira
  await section.getByRole('button', { name: 'Tirar 03 - M01 - Assis do material' }).click();
  const removed = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/project_files') && r.request().method() === 'DELETE',
  );
  await page.getByRole('button', { name: 'Tirar', exact: true }).click();
  expect((await removed).ok()).toBe(true);
  await expect(section.getByRole('link')).toHaveText([/04 - M01 - Equilíbrio/]);
  await page.goto('/lixeira');
  await expect(page.getByText('03 - M01 - Assis.pdf')).toBeVisible();
});
