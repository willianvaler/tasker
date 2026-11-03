import { expect, test, type Page } from '@playwright/test';

import { signUp } from './helpers';

async function newNote(page: Page, desktop: boolean) {
  if (desktop) await page.getByRole('button', { name: 'Nova anotação' }).first().click();
  else {
    await page.getByRole('button', { name: 'Novo', exact: true }).last().click();
    await page.getByRole('menuitem', { name: 'Anotação' }).click();
  }
  await expect(page.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue('');
}

// OB9 (ESCOPO_V11 §6, D294): o grafo global com os filtros, o grafo local na anotação e o ponto
// do que ainda não existe, que cria a anotação ao ser aberto.
test('anotações: grafo global e local', async ({ page }, testInfo) => {
  const desktop = testInfo.project.name === 'desktop';
  const stamp = `${testInfo.project.name}${Date.now()}`;
  await signUp(page, testInfo);

  await newNote(page, desktop);
  await page.getByRole('textbox', { name: 'Título da anotação' }).fill(`Alfa ${stamp}`);
  await page
    .getByRole('textbox', { name: 'Texto da anotação' })
    .fill(`Ligada a [[Beta ${stamp}]] e a [[Gama ${stamp}]].`);
  await page.waitForTimeout(1500);

  // Grafo local, embaixo da anotação
  await page.getByRole('button', { name: 'Visualizar' }).click();
  await expect(page.getByTestId('local-graph')).toBeVisible();
  await page.getByTestId('local-graph').getByRole('button', { name: 'Abrir no grafo' }).click();
  await expect(page.getByText(`Ligado a: Alfa ${stamp}`)).toBeVisible();
  await expect(page.getByTestId('graph-count')).toHaveText('3 pontos · 2 ligações');
  await page.getByRole('button', { name: 'Ver tudo' }).click();

  // Filtro: sem os que ainda não existem, a Alfa fica solta
  await page.getByRole('checkbox', { name: 'Ainda não existe' }).click();
  await expect(page.getByTestId('graph-count')).toHaveText(/^1 ponto · 0 ligaç/);
  await page.getByRole('checkbox', { name: 'Soltas' }).click();
  await expect(page.getByText('Nada para mostrar')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Ainda não existe' }).click();
  await page.getByRole('checkbox', { name: 'Soltas' }).click();

  // Procurar põe o foco; abrir o ponto do que não existe cria a anotação
  await page.getByRole('textbox', { name: 'Procurar no grafo' }).fill(`Beta ${stamp}`);
  await page.getByRole('button', { name: `Beta ${stamp} · Ainda não existe` }).click();
  await expect(page.getByText(`Ligado a: Beta ${stamp}`)).toBeVisible();
  await page
    .getByTestId('graph-canvas')
    .getByRole('group', { name: `Beta ${stamp}` })
    .click();
  await expect(page.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue(
    `Beta ${stamp}`,
  );
});
