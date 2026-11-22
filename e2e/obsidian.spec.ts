import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

import { signUp } from './helpers';

// OB13 (ESCOPO_V11 §8, D298): importar um cofre do Obsidian (.zip) com frontmatter e [[links]]
// pelo título, e exportar de volta (um .md por anotação, links pelo nome do arquivo).
test('anotações: importar e exportar cofre do Obsidian', async ({ page }, testInfo) => {
  const stamp = `${testInfo.project.name}${Date.now()}`;
  await signUp(page, testInfo);

  const zip = zipSync({
    [`Cofre/Receitas/Pão ${stamp}.md`]: strToU8(
      `---\ntags: [cozinha]\nnota: 5\n---\nUsa [[Farinha ${stamp}]] e [[Fermento ${stamp}]].`,
    ),
    [`Cofre/Farinha ${stamp}.md`]: strToU8(`Volta para [[Pão ${stamp}|o pão]].`),
    'Cofre/Imagens/foto.png': new Uint8Array([1, 2, 3]),
    'Cofre/.obsidian/app.json': strToU8('{}'),
  });

  await page.goto('/notas');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar do Obsidian (.zip)' }).click();
  await (
    await chooser
  ).setFiles({ name: `cofre-${stamp}.zip`, mimeType: 'application/zip', buffer: Buffer.from(zip) });

  // Conferir antes: 2 anotações, 1 link para o que não existe, os arquivos que não são .md
  await expect(page.getByText('Importar 2 anotações?')).toBeVisible();
  await expect(page.getByText(/1 link aponta para o que não existe/)).toBeVisible();
  await expect(page.getByText(/2 arquivos ficam de fora/)).toBeVisible();
  const created = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/notes') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Importar', exact: true }).click();
  expect((await created).ok()).toBe(true);
  await expect(page.getByText('2 anotações importadas.')).toBeVisible();

  // O link pelo título virou link de verdade: abre a outra anotação
  await page
    .getByRole('link', { name: new RegExp(`^Pão ${stamp}`) })
    .last()
    .click();
  await expect(page.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue(
    `Pão ${stamp}`,
  );
  await expect(page.getByText('cozinha').first()).toBeVisible();
  await page
    .getByRole('link', { name: `Farinha ${stamp}`, exact: true })
    .first()
    .click();
  await expect(page.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue(
    `Farinha ${stamp}`,
  );

  // Exportar: o .zip tem um .md por anotação, com frontmatter e os links pelo nome do arquivo
  await page.goto('/notas');
  const exportButton = page.getByRole('button', { name: 'Exportar para o Obsidian (.zip)' });
  await expect(
    page.getByRole('link', { name: new RegExp(`^Farinha ${stamp}`) }).last(),
  ).toBeVisible();
  await expect(exportButton).toBeEnabled();
  const download = page.waitForEvent('download');
  await exportButton.click();
  const files = unzipSync(new Uint8Array(readFileSync(await (await download).path())));
  const pao = strFromU8(files[`Pão ${stamp}.md`]);
  expect(pao).toContain('tags:\n  - cozinha');
  expect(pao).toContain('nota: 5');
  expect(pao).toContain(`[[Farinha ${stamp}]]`);
  expect(pao).toContain(`[[Fermento ${stamp}]]`);
  expect(strFromU8(files[`Farinha ${stamp}.md`])).toContain(`[[Pão ${stamp}`);
});

// ES3 (D324): as imagens citadas pelos .md vão junto, aparecem na anotação e voltam ao exportar
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

test('anotações: o cofre do Obsidian leva e traz as imagens', async ({ page }, testInfo) => {
  const stamp = `${testInfo.project.name}${Date.now()}`;
  await signUp(page, testInfo);
  const zip = zipSync({
    [`material/Torque ${stamp}.md`]: strToU8(
      `A porta:\n\n![Porta vista de cima](img/porta.png)\n\nfim`,
    ),
    'material/img/porta.png': new Uint8Array(PNG),
    'material/img/sobra.png': new Uint8Array(PNG),
  });
  await page.goto('/notas');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar do Obsidian (.zip)' }).click();
  await (
    await chooser
  ).setFiles({ name: `cofre-${stamp}.zip`, mimeType: 'application/zip', buffer: Buffer.from(zip) });
  await expect(page.getByText('1 imagem vai junto.', { exact: false })).toBeVisible();
  await expect(page.getByText(/1 arquivo fica de fora/)).toBeVisible();
  await page.getByRole('button', { name: 'Importar', exact: true }).click();
  await expect(page.getByText('1 imagem enviada.')).toBeVisible({ timeout: 60_000 });

  await page
    .getByRole('link', { name: new RegExp(`^Torque ${stamp}`) })
    .last()
    .click();
  await expect(page.getByTestId('note-image')).toBeVisible();
  await expect(page.getByTestId('note-image-missing')).toHaveCount(0);
  await expect(page.getByTestId('note-image').getByText('Porta vista de cima')).toBeVisible();

  await page.goto('/notas');
  const exportButton = page.getByRole('button', { name: 'Exportar para o Obsidian (.zip)' });
  await expect(exportButton).toBeEnabled();
  const download = page.waitForEvent('download');
  await exportButton.click();
  const files = unzipSync(new Uint8Array(readFileSync(await (await download).path())));
  const md = strFromU8(files[`Torque ${stamp}.md`]);
  const image = /!\[Porta vista de cima\]\((anexos\/[^)]+\.png)\)/.exec(md)?.[1];
  expect(image).toBeTruthy();
  expect(files[image ?? ''].length).toBe(PNG.length);
});

// ES3: no editor, "Inserir imagem" envia a imagem (reduzida) e põe o link onde está o cursor
test('anotações: inserir imagem no editor', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Nova anotação pelo botão da barra lateral');
  await signUp(page, testInfo);
  await page.goto('/notas');
  await page.getByRole('button', { name: 'Nova anotação' }).first().click();
  await page.getByRole('textbox', { name: 'Título da anotação' }).fill('Com figura');
  const body = page.getByRole('textbox', { name: 'Texto da anotação' });
  await body.fill('Antes da figura.');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Inserir imagem' }).click();
  await (await chooser).setFiles({ name: 'porta.png', mimeType: 'image/png', buffer: PNG });
  await expect(body).toHaveValue(
    /Antes da figura\.\n\n!\[porta\]\(qlimg:[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg)\)/,
    {
      timeout: 30_000,
    },
  );
  await page.getByRole('button', { name: 'Visualizar' }).click();
  await expect(page.getByTestId('note-image')).toBeVisible();
});
