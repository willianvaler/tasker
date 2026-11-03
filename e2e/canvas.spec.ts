import { readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { createPage, openTab, signUp } from './helpers';

const savedPage = (page: Page) =>
  page.waitForResponse(
    (r) => r.url().includes('/rest/v1/pages') && r.request().method() === 'PATCH',
  );

// OB10 (ESCOPO_V11 §6, D295): o canvas com texto solto, grupo e o cartão de uma tarefa de verdade
// (a caixinha conclui), guardado e exportado em JSON Canvas.
test('canvas: texto, grupo, tarefa de verdade e exportar', async ({ page }, testInfo) => {
  const stamp = `${testInfo.project.name}${Date.now()}`;
  await signUp(page, testInfo);

  await openTab(page, 'Caixa de entrada');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(`Pintar ${stamp}`);
  await input.press('Enter');
  await expect(page.getByRole('checkbox', { name: `Concluir Pintar ${stamp}` })).toBeVisible();

  await createPage(page, { folder: `Casa ${stamp}`, name: `Mapa ${stamp}`, type: 'Canvas' });
  const canvas = page.getByTestId('canvas');
  await expect(canvas.getByText(/Comece com Texto ou Cartão/)).toBeVisible();

  // Texto solto: nasce já editando
  let saved = savedPage(page);
  await page.getByRole('button', { name: 'Texto', exact: true }).click();
  await page.keyboard.type(`Ideia ${stamp}`);
  await canvas.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } });
  await saved;
  await expect(canvas.getByText(`Ideia ${stamp}`)).toBeVisible();

  // Grupo com nome
  saved = savedPage(page);
  await page.getByRole('button', { name: 'Grupo', exact: true }).click();
  await page.getByPlaceholder('Nome do grupo').fill(`Sala ${stamp}`);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await saved;
  await expect(canvas.getByText(`Sala ${stamp}`)).toBeVisible();

  // Cartão da tarefa: é a mesma tarefa, a caixinha conclui
  saved = savedPage(page);
  await page.getByRole('button', { name: 'Cartão', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Procurar anotação, tarefa, lista ou pasta' })
    .fill(`Pintar ${stamp}`);
  await page.getByRole('button', { name: new RegExp(`Pintar ${stamp}`) }).click();
  await saved;
  const box = canvas.getByRole('checkbox', { name: `Concluir Pintar ${stamp}` });
  await box.click();
  await page.waitForResponse((r) => r.url().includes('/rpc/complete_task'));
  await expect(canvas.getByRole('checkbox', { name: `Reabrir Pintar ${stamp}` })).toBeChecked();

  // Guardado: volta igual (espera o cache do disco gravar a tarefa concluída)
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(canvas.getByText(`Ideia ${stamp}`)).toBeVisible();
  await expect(canvas.getByText(`Sala ${stamp}`)).toBeVisible();
  await expect(canvas.getByRole('checkbox', { name: `Reabrir Pintar ${stamp}` })).toBeVisible();

  // Exportar em JSON Canvas
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar .canvas' }).click();
  const file = await (await download).path();
  const json = JSON.parse(readFileSync(file, 'utf8'));
  expect(json.nodes).toHaveLength(3);
  expect(json.nodes.map((n: { type: string }) => n.type).sort()).toEqual(['group', 'text', 'text']);
  expect(JSON.stringify(json)).toContain(`Pintar ${stamp}`);
});
