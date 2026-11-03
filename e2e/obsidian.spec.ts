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
  await expect(page.getByText(/2 arquivos que não são .md/)).toBeVisible();
  const created = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/notes') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Importar', exact: true }).click();
  expect((await created).ok()).toBe(true);
  await expect(page.getByText('2 anotações importadas.')).toBeVisible();

  // O link pelo título virou link de verdade: abre a outra anotação
  await page.getByRole('link', { name: new RegExp(`^Pão ${stamp}`) }).last().click();
  await expect(page.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue(`Pão ${stamp}`);
  await expect(page.getByText('cozinha').first()).toBeVisible();
  await page.getByRole('link', { name: `Farinha ${stamp}`, exact: true }).first().click();
  await expect(page.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue(
    `Farinha ${stamp}`,
  );

  // Exportar: o .zip tem um .md por anotação, com frontmatter e os links pelo nome do arquivo
  await page.goto('/notas');
  const exportButton = page.getByRole('button', { name: 'Exportar para o Obsidian (.zip)' });
  await expect(page.getByRole('link', { name: new RegExp(`^Farinha ${stamp}`) }).last()).toBeVisible();
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
