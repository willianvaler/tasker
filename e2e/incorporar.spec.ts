import { expect, test, type Page } from '@playwright/test';

import { createPage, signUp } from './helpers';

async function newNote(page: Page, desktop: boolean) {
  if (desktop) await page.getByRole('button', { name: 'Nova anotação' }).first().click();
  else {
    await page.getByRole('button', { name: 'Novo', exact: true }).last().click();
    await page.getByRole('menuitem', { name: 'Anotação' }).click();
  }
  await expect(page.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue('');
}

// OB6 (ESCOPO_V11 §7, D291): ![[...]] incorpora outra anotação (inteira ou um trecho), uma lista com
// as caixinhas de verdade; a prévia aparece ao passar o mouse (no celular, no toque longo).
test('anotações: incorporar e prévia do link', async ({ page }, testInfo) => {
  const desktop = testInfo.project.name === 'desktop';
  const stamp = `${testInfo.project.name}${Date.now()}`;
  await signUp(page, testInfo);

  // Uma lista com uma tarefa
  const pageId = await createPage(page, {
    folder: `Casa ${stamp}`,
    name: `Mercado ${stamp}`,
    type: 'Lista',
  });
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(`Pão ${stamp}`);
  await input.press('Enter');
  await expect(page.getByRole('checkbox', { name: `Concluir Pão ${stamp}` })).toBeVisible();

  // A anotação que vai ser incorporada
  await page.goto('/');
  await newNote(page, desktop);
  const recipe = `Receita ${stamp}`;
  await page.getByRole('textbox', { name: 'Título da anotação' }).fill(recipe);
  await page
    .getByRole('textbox', { name: 'Texto da anotação' })
    .fill('## Massa\nfarinha e ovos\n## Recheio\nqueijo');
  await page.waitForTimeout(1500);

  // A outra: "/incorporar" põe o ![[ e o autocomplete escolhe a anotação
  await page.goto('/');
  await newNote(page, desktop);
  await page.getByRole('textbox', { name: 'Título da anotação' }).fill(`Semana ${stamp}`);
  const body = page.getByRole('textbox', { name: 'Texto da anotação' });
  await body.click();
  await body.pressSequentially('/incorp');
  await body.press('Enter');
  await expect(body).toHaveValue('![[');
  await body.pressSequentially('Receita');
  await page
    .getByRole('list', { name: 'Sugestões de link' })
    .getByRole('button', { name: `Ligar a ${recipe}` })
    .click();
  const value = await body.inputValue();
  const id = /\|n:([0-9a-f-]{36})\]\]$/.exec(value)?.[1];
  expect(value.startsWith('![[')).toBe(true);
  expect(id).toBeTruthy();
  await body.fill(
    [
      value,
      '',
      `![[${recipe}#Recheio|n:${id}]]`,
      '',
      `![[Mercado|p:${pageId}]]`,
      '',
      `Ver [[${recipe}|n:${id}]]`,
    ].join('\n'),
  );
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Visualizar' }).click();

  // A anotação inteira e só o trecho do Recheio
  const notes = page.getByTestId('embed-note');
  await expect(notes).toHaveCount(2);
  await expect(notes.first()).toContainText('farinha e ovos');
  await expect(notes.first()).toContainText('queijo');
  await expect(notes.last()).toContainText('queijo');
  await expect(notes.last()).not.toContainText('farinha');

  // A lista com a caixinha de verdade: concluir aqui conclui lá
  const list = page.getByTestId('embed-page');
  await expect(list).toContainText(`Mercado ${stamp}`);
  await list.getByRole('checkbox', { name: `Concluir Pão ${stamp}` }).click();
  await page.waitForResponse((r) => r.url().includes('/rpc/complete_task'));
  await expect(list.getByRole('checkbox', { name: `Reabrir Pão ${stamp}` })).toBeVisible();

  // Prévia do link
  // O do texto (a barra lateral e o "Links que saem" também têm um link com o nome)
  const link = page
    .getByRole('link', { name: recipe, exact: true })
    .and(page.locator('span'))
    .first();
  if (desktop) {
    await link.hover();
    await expect(page.getByTestId('link-preview')).toBeVisible();
    await expect(page.getByTestId('link-preview')).toContainText('farinha e ovos');
    await page.mouse.move(0, 0);
    await expect(page.getByTestId('link-preview')).toHaveCount(0);
  } else {
    // Toque longo: no navegador do celular chega como o menu de contexto
    await link.dispatchEvent('contextmenu');
    await expect(page.getByText('farinha e ovos', { exact: false }).last()).toBeVisible();
    await page.getByRole('button', { name: 'Abrir', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue(recipe);
  }
});
