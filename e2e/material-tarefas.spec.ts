import { expect, test, type Page } from '@playwright/test';

import { createPage, signUp, waitForSync } from './helpers';

// ES6 (ESCOPO_V13 §4, D327): o material liga sozinho pelo código no nome do arquivo (M01 → "M01 ·
// ..."; "Fase 1A" → a lista "Fase 1A · ..."), à mão pelo painel, e desfazer a automática; o grafo
// mostra o material ligado.
const PDF = Buffer.from(`%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
trailer<</Root 1 0 R>>
%%EOF`);

async function openPanel(page: Page, title: string) {
  await page.getByRole('button', { name: `Detalhes de ${title}` }).click();
  await expect(page.getByRole('textbox', { name: 'Título', exact: true })).toHaveValue(title);
  return page.getByTestId('task-materials');
}

test('material: liga pelo código, herda da lista, liga e desliga à mão, aparece no grafo', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const stamp = `${testInfo.project.name}${Date.now()}`;
  const folder = `Plano ${stamp}`;
  await signUp(page, testInfo);
  await createPage(page, { folder, name: 'Fase 1A · Alavancas', type: 'Lista' });
  const listUrl = page.url();
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  for (const title of ['M01 · Balança de régua', 'M02 · Ponte de palitos']) {
    await input.fill(title);
    await input.press('Enter');
    await expect(page.getByRole('button', { name: `Detalhes de ${title}` })).toBeVisible();
  }

  // A ligação pelo código é calculada no servidor: as tarefas precisam ter subido
  await waitForSync(page);

  // O material entra pela pasta
  await page.goto('/folders');
  await page.getByRole('link', { name: folder }).first().click();
  await expect(page.getByRole('heading', { name: folder })).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Adicionar material' }).click();
  await (
    await chooser
  ).setFiles([
    { name: '03 - M01 - Assis.pdf', mimeType: 'application/pdf', buffer: PDF },
    { name: '01 - Fase 1A - Introdução.pdf', mimeType: 'application/pdf', buffer: PDF },
  ]);
  await expect(page.getByText(/2 materiais adicionados/)).toBeVisible({ timeout: 60_000 });

  // M01: pelo código
  await page.goto(listUrl);
  let section = await openPanel(page, 'M01 · Balança de régua');
  await expect(section.getByRole('link', { name: '03 - M01 - Assis' })).toBeVisible();
  await expect(section.getByText('pelo código')).toBeVisible();

  // Desfazer a automática: fica o da lista
  await section.getByRole('button', { name: 'Desligar 03 - M01 - Assis desta tarefa' }).click();
  await expect(section.getByRole('link', { name: '01 - Fase 1A - Introdução' })).toBeVisible();
  await expect(section.getByText('da lista: Fase 1A · Alavancas')).toBeVisible();
  await expect(section.getByRole('link', { name: '03 - M01 - Assis' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Voltar' }).last().click();

  // M02: herda da lista; à mão, o Assis também
  section = await openPanel(page, 'M02 · Ponte de palitos');
  await expect(section.getByText('da lista: Fase 1A · Alavancas')).toBeVisible();
  await section.getByRole('button', { name: 'Ligar material' }).click();
  const linked = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/material_links') && r.request().method() === 'POST',
  );
  await page.getByRole('checkbox', { name: '03 - M01 - Assis' }).click();
  expect((await linked).ok()).toBe(true);
  await page.getByRole('button', { name: 'Fechar' }).last().click();
  await expect(section.getByRole('link', { name: '03 - M01 - Assis' })).toBeVisible();
  await expect(section.getByText('ligado à mão')).toBeVisible();
  await expect(section.getByText(/da lista/)).toHaveCount(0);

  // Tocar abre o leitor
  await section.getByRole('link', { name: '03 - M01 - Assis' }).click();
  await expect(page.getByRole('heading', { name: '03 - M01 - Assis' })).toBeVisible();

  // No grafo, o material ligado aparece (busca pelo nome)
  await page.goto('/grafo');
  await page.getByRole('textbox', { name: 'Procurar no grafo' }).fill('Assis');
  await expect(page.getByText('03 - M01 - Assis · Material')).toBeVisible();
});
