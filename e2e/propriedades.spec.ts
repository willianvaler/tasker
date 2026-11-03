import { expect, test, type Page } from '@playwright/test';

import { openTab, signUp } from './helpers';

async function newNote(page: Page, desktop: boolean) {
  if (desktop) await page.getByRole('button', { name: 'Nova anotação' }).first().click();
  else {
    await page.getByRole('button', { name: 'Novo', exact: true }).last().click();
    await page.getByRole('menuitem', { name: 'Anotação' }).click();
  }
}

// OB4 (ESCOPO_V11 §3, D289): propriedades com tipo, apelidos, #etiquetas aninhadas e a tela de
// etiquetas, que junta as das anotações e as das tarefas.
test('anotações: propriedades, apelidos e etiquetas', async ({ page }, testInfo) => {
  const desktop = testInfo.project.name === 'desktop';
  const stamp = `${testInfo.project.name}${Date.now()}`;
  const tag = `leitura${stamp}`;
  await signUp(page, testInfo);

  // Uma tarefa com a mesma etiqueta (as das tarefas não aninham)
  await openTab(page, 'Caixa de entrada');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(`Comprar livro #${tag}`);
  await input.press('Enter');
  await expect(page.getByText('Comprar livro', { exact: true }).first()).toBeVisible();

  await newNote(page, desktop);
  const title = `Duna ${stamp}`;
  await page.getByRole('textbox', { name: 'Título da anotação' }).fill(title);
  await page
    .getByRole('textbox', { name: 'Texto da anotação' })
    .fill(`Gostei muito #${tag}/ficcao`);

  // Propriedade "nota", número
  await page.getByRole('button', { name: 'Propriedade', exact: true }).click();
  await page.getByPlaceholder('Nome da propriedade').fill('nota');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.getByRole('button', { name: /Propriedade nota/ }).click();
  await page.getByRole('menuitem', { name: 'Mudar para número' }).click();
  const value = page.getByRole('textbox', { name: 'nota', exact: true });
  await value.fill('4');
  await value.press('Enter');

  // Apelidos: lista
  await page.getByRole('button', { name: 'Propriedade', exact: true }).click();
  await page.getByPlaceholder('Nome da propriedade').fill('aliases');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  const alias = page.getByRole('textbox', { name: 'Adicionar em aliases' });
  await alias.fill(`Arrakis${stamp}`);
  await alias.press('Enter');

  // Formatada: as propriedades aparecem e a etiqueta abre a tela de etiquetas
  await page.getByRole('button', { name: 'Visualizar' }).click();
  const props = page.getByRole('list', { name: 'Propriedades' });
  await expect(props).toContainText('4');
  await expect(props).toContainText(`Arrakis${stamp}`);
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.getByRole('list', { name: 'Propriedades' })).toContainText(`Arrakis${stamp}`, {
    timeout: 15_000,
  });
  await page
    .getByRole('link', { name: `#${tag}/ficcao` })
    .first()
    .click();
  await expect(
    page.getByRole('link', { name: new RegExp(`^${title}.*Gostei`) }).last(),
  ).toBeVisible();

  // A mãe acha a filha e a tarefa
  await page.goto(`/etiquetas?tag=${tag}`);
  await expect(
    page.getByRole('link', { name: new RegExp(`^${title}.*Gostei`) }).last(),
  ).toBeVisible();
  await expect(page.getByText('Comprar livro', { exact: true }).last()).toBeVisible();
  await expect(page.getByRole('link', { name: `#${tag}/ficcao` }).last()).toBeVisible();

  // O apelido entra no autocomplete do [[
  await page.goto('/');
  await newNote(page, desktop);
  const body = page.getByRole('textbox', { name: 'Texto da anotação' });
  await body.click();
  await body.pressSequentially(`[[Arrakis${stamp.slice(0, 6)}`);
  await expect(
    page
      .getByRole('list', { name: 'Sugestões de link' })
      .getByRole('button', { name: `Ligar a ${title}` }),
  ).toBeVisible();
});
