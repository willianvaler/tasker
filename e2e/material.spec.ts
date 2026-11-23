import { expect, test } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';

import { openTab, signUp } from './helpers';

// ES4/ES5 (ESCOPO_V13 §3, D325/D326): material da pasta. Adicionar PDF + .md (com a imagem que ele
// cita), um simulador em HTML (fica como arquivo e roda isolado) e um .zip com um livro em HTML (vira
// anotação, com a imagem); o que não entra fica de fora; o PDF abre no leitor do navegador; tirar
// leva para a lixeira.
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
  // A pasta nova abre sozinha; a árvore pode levar um pouco para recarregar
  await expect(page.getByRole('heading', { name: folder })).toBeVisible({ timeout: 20_000 });

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
    {
      name: '05 - PhET.html',
      mimeType: 'text/html',
      // Roda o script e tenta alcançar o app: no quadro isolado, não consegue
      buffer: Buffer.from(`<html><body><script>
        let out = 'rodou';
        try { out += parent.document.title ? ' e viu o app' : ''; } catch { out += ', isolado'; }
        try { localStorage.length; out += ' com armazenamento'; } catch { out += ', sem armazenamento'; }
        document.body.textContent = out;
      </script></body></html>`),
    },
    {
      name: 'livro.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(
        zipSync({
          'material/06 - M02 - Vitrúvio/index.html': strToU8(
            '<h1>Vitrúvio</h1><p>A educação do arquiteto.</p><img src="images/caria.png" alt="Cariátides">',
          ),
          'material/06 - M02 - Vitrúvio/images/caria.png': new Uint8Array(PNG),
          'material/mapa.canvas': strToU8('{}'),
          'material/.obsidian/app.json': strToU8('{}'),
        }),
      ),
    },
  ]);
  await expect(
    page.getByText(
      /4 materiais adicionados\. 1 HTML interativo guardado como está\. 1 arquivo ficou de fora/,
    ),
  ).toBeVisible({ timeout: 60_000 });

  // A lista do material, na ordem do nome
  const section = page.getByTestId('materials');
  await expect(section.getByRole('link')).toHaveText([
    /03 - M01 - Assis/,
    /04 - M01 - Equilíbrio/,
    /05 - PhET/,
    /06 - M02 - Vitrúvio/,
  ]);
  await expect(section.getByText(/^PDF · /)).toBeVisible();
  await expect(section.getByText(/^HTML interativo · /)).toBeVisible();

  // O simulador roda isolado: o script funciona, mas não alcança o app nem o armazenamento
  await section.getByRole('link', { name: '05 - PhET' }).click();
  const frame = page.frameLocator('[data-testid="html-frame"]');
  await expect(frame.locator('body')).toHaveText('rodou, isolado, sem armazenamento');
  await expect(page.getByTestId('html-frame')).toHaveAttribute('sandbox', 'allow-scripts');
  await page.goBack();

  // O livro em HTML virou anotação da pasta, com a imagem (aberta na leitura)
  await section.getByRole('link', { name: '06 - M02 - Vitrúvio' }).click();
  await expect(page.getByRole('heading', { name: '06 - M02 - Vitrúvio' })).toBeVisible();
  await expect(page.getByTestId('note-reader').getByText('A educação do arquiteto.')).toBeVisible();
  await expect(page.getByTestId('note-reader').getByTestId('note-image')).toBeVisible();
  await page.goBack();

  // O .md virou anotação da pasta: abre na leitura, e Editar leva ao editor
  await section.getByRole('link', { name: '04 - M01 - Equilíbrio' }).click();
  await expect(page.getByRole('heading', { name: '04 - M01 - Equilíbrio' })).toBeVisible();
  await page.getByTestId('note-reader').getByRole('button', { name: 'Editar' }).click();
  await expect(page.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue(
    '04 - M01 - Equilíbrio',
  );
  await page.goBack();
  await page.goBack();

  // O PDF abre no leitor do app (pdf.js num quadro), com o arquivo em blob:
  await section.getByRole('link', { name: '03 - M01 - Assis' }).click();
  await expect(page.getByRole('heading', { name: '03 - M01 - Assis' })).toBeVisible();
  await expect(page.getByTestId('pdf-frame')).toHaveAttribute('srcdoc', /blob:/);
  await page.goBack();

  // Tirar: vai para a lixeira
  await section.getByRole('button', { name: 'Tirar 03 - M01 - Assis do material' }).click();
  const removed = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/project_files') && r.request().method() === 'DELETE',
  );
  await page.getByRole('button', { name: 'Tirar', exact: true }).click();
  expect((await removed).ok()).toBe(true);
  await expect(section.getByRole('link')).toHaveText([
    /04 - M01 - Equilíbrio/,
    /05 - PhET/,
    /06 - M02 - Vitrúvio/,
  ]);
  await page.goto('/lixeira');
  await expect(page.getByText('03 - M01 - Assis.pdf')).toBeVisible();
});
