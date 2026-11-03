import { expect, test, type Page } from '@playwright/test';

import { createPage, openTab, signUp } from './helpers';

const savedPage = (page: Page) =>
  page.waitForResponse(
    (r) => r.url().includes('/rest/v1/pages') && r.request().method() === 'PATCH',
  );

// OB8 (ESCOPO_V11 §5, D293): a lista do tipo Base mostra as tarefas da consulta em tabela (editar
// na célula, ordenar pelo cabeçalho, agrupar, colunas) e em cartões; a configuração fica guardada.
test('bases: tabela, edição na célula e cartões', async ({ page }, testInfo) => {
  const stamp = `${testInfo.project.name}${Date.now()}`;
  const tag = `obra${stamp}`;
  await signUp(page, testInfo);

  await openTab(page, 'Caixa de entrada');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  for (const title of [`Pintar ${stamp} #${tag} !!`, `Lixar ${stamp} #${tag}`]) {
    await input.fill(title);
    await input.press('Enter');
  }
  await expect(page.getByRole('checkbox', { name: `Concluir Lixar ${stamp}` })).toBeVisible();

  await createPage(page, { folder: `Casa ${stamp}`, name: `Base ${stamp}`, type: 'Base' });
  // Nasce com uma consulta de exemplo, que dá para trocar
  const query = page.getByRole('textbox', { name: 'Consulta da base' });
  await expect(query).toHaveValue(/^tarefas onde vence/);
  await query.fill(`tarefas onde etiqueta = ${tag} ordenar por título`);
  const saved = savedPage(page);
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await saved;

  const table = page.getByRole('table');
  await expect(table.getByRole('checkbox')).toHaveCount(2);
  await expect(table.getByRole('checkbox').first()).toHaveAccessibleName(`Concluir Lixar ${stamp}`);
  await expect(page.getByTestId('base-count')).toHaveText('2 tarefas');
  await expect(table.getByRole('cell', { name: 'Prioridade: !!' })).toBeVisible();

  // Editar o título e a prioridade na célula
  await table.getByRole('cell', { name: `Título: Lixar ${stamp}` }).click();
  const cell = table.getByRole('textbox', { name: `Título: Lixar ${stamp}` });
  await cell.fill(`Lixar a porta ${stamp}`);
  const patched = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/tasks') && r.request().method() === 'PATCH',
  );
  await cell.press('Enter');
  await patched;
  await expect(table.getByRole('cell', { name: `Título: Lixar a porta ${stamp}` })).toBeVisible();
  await table.getByRole('cell', { name: 'Prioridade: vazio' }).click();
  await table.getByRole('textbox', { name: `Prioridade: Lixar a porta ${stamp}` }).fill('3');
  await table.getByRole('textbox', { name: `Prioridade: Lixar a porta ${stamp}` }).press('Enter');
  await expect(table.getByRole('cell', { name: 'Prioridade: !!!' })).toBeVisible();

  // Ordenar pelo cabeçalho: prioridade crescente põe o !! na frente
  await page.getByRole('columnheader', { name: 'Ordenar por Prioridade' }).click();
  await expect(table.getByRole('checkbox').first()).toHaveAccessibleName(
    `Concluir Pintar ${stamp}`,
  );

  // Concluir pela base e agrupar pelo status
  await table.getByRole('checkbox', { name: `Concluir Pintar ${stamp}` }).click();
  await page.waitForResponse((r) => r.url().includes('/rpc/complete_task'));
  await page.getByRole('button', { name: 'Agrupar' }).click();
  await page.getByRole('radio', { name: 'Status' }).click();
  await expect(table.getByText('Concluída', { exact: true })).toBeVisible();
  await expect(table.getByText('A fazer', { exact: true })).toBeVisible();

  // Cartões, e a escolha fica guardada
  const cards = savedPage(page);
  await page.getByRole('radio', { name: 'Cartões' }).click();
  await cards;
  await expect(page.getByRole('link', { name: `Lixar a porta ${stamp}` })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Cartões' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('link', { name: `Pintar ${stamp}` })).toBeVisible();
});
