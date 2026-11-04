import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { createPage, signUp, waitForSync } from './helpers';

// PB9 (V3 §6 B, D304): a lista sai em CSV e Markdown (baixados) e vai para a impressão do
// navegador (que salva em PDF), com as subtarefas, o feito e a descrição.
test('exportar a lista: CSV, Markdown e imprimir', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'baixar arquivo: basta um perfil');
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Casa', name: 'Mudança', type: 'Lista' });
  await page.getByRole('button', { name: 'Adicionar várias' }).click();
  await page
    .getByRole('textbox', { name: 'Lista de tarefas' })
    .fill('Caixas !! #compras\n  Fita\n[x] Contratar o frete');
  await page.getByRole('button', { name: 'Criar 3' }).click();
  await expect(page.getByRole('checkbox', { name: 'Concluir Caixas' })).toBeVisible();
  await waitForSync(page);

  const openExport = async () => {
    await page.getByRole('button', { name: 'Opções da lista' }).click();
    await page.getByRole('menuitem', { name: 'Exportar…' }).click();
  };

  await openExport();
  let download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Planilha (CSV)' }).click();
  const csv = await readFile((await (await download).path()) ?? '', 'utf8');
  expect((await download).suggestedFilename()).toBe('Mudança.csv');
  expect(csv).toContain('Nº;Tarefa;Feita;Vence;Prioridade;Etiquetas;Descrição');
  expect(csv).toContain('1;Caixas;;;2;compras;');
  expect(csv).toContain('1.1;Fita;;;;compras;');
  expect(csv).toContain('2;Contratar o frete;sim;;;;');

  await openExport();
  download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Markdown (Obsidian, outros apps)' }).click();
  const md = await readFile((await (await download).path()) ?? '', 'utf8');
  expect(md).toBe('# Mudança\n\n- [ ] Caixas !! #compras\n  - [ ] Fita #compras\n- [x] Contratar o frete\n');

  // Imprimir: a página da lista vai para um quadro escondido e o navegador imprime
  await page.evaluate(() => {
    Object.assign(window, { __printed: '' });
    new MutationObserver((records) => {
      for (const r of records)
        for (const node of r.addedNodes)
          if (node instanceof HTMLIFrameElement && node.srcdoc)
            Object.assign(window, { __printed: node.srcdoc });
    }).observe(document.body, { childList: true });
  });
  const printed = () => page.evaluate(() => (window as unknown as { __printed: string }).__printed);
  await openExport();
  await page.getByRole('menuitem', { name: 'Imprimir ou salvar em PDF' }).click();
  await expect.poll(printed).toContain('<h1>Mudança</h1>');
  const html = await printed();
  expect(html).toContain('1 de 3 feitas');
  expect(html).toContain('class="done"');
});
