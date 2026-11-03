import { expect, test, type Page } from '@playwright/test';

import { signUp } from './helpers';

const savedNote = (page: Page) =>
  page.waitForResponse(
    (r) => r.url().includes('/rest/v1/notes') && r.request().method() === 'PATCH' && r.ok(),
  );
const savedPrefs = (page: Page) =>
  page.waitForResponse(
    (r) => r.url().includes('/rest/v1/profiles') && r.request().method() === 'PATCH' && r.ok(),
  );

async function newNote(page: Page, title: string, body: string) {
  await page.goto('/notas');
  await page.getByRole('button', { name: 'Nova anotação' }).first().click();
  await page.getByRole('textbox', { name: 'Título da anotação' }).fill(title);
  const saved = savedNote(page);
  await page.getByRole('textbox', { name: 'Texto da anotação' }).fill(body);
  await saved;
  await page.waitForTimeout(900);
  return /\/nota\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? '';
}

// OB12 (ESCOPO_V11 §7, D297): favoritos (anotação e busca), busca com operadores na paleta, tela
// dividida no computador e a anotação aleatória.
test('anotações: favoritos, busca com operadores, tela dividida e aleatória', async ({
  page,
}, testInfo) => {
  const desktop = testInfo.project.name === 'desktop';
  const stamp = `${testInfo.project.name}${Date.now()}`;
  await signUp(page, testInfo);
  const second = await newNote(page, `Bolo ${stamp}`, 'farinha e ovos #doce');
  await newNote(page, `Pão ${stamp}`, 'farinha, água e sal #casa/cozinha');

  // Favorito pela anotação aberta
  let prefs = savedPrefs(page);
  await page.getByRole('button', { name: 'Mais opções da anotação' }).click();
  await page.getByRole('menuitem', { name: 'Adicionar aos favoritos' }).click();
  await prefs;
  await page.goto('/notas');
  const favorites = page.getByRole('list', { name: 'Favoritos' });
  await expect(favorites.first().getByRole('link', { name: `Pão ${stamp}` })).toBeVisible();

  // Busca com operadores: só a anotação com a etiqueta (a filha conta), sem os comandos
  await page.keyboard.press('Control+k');
  const search = page.getByRole('textbox', { name: 'Buscar ou executar' });
  await search.fill(`farinha tag:casa tipo:nota`);
  await expect(page.getByRole('button', { name: new RegExp(`^Pão ${stamp}`) })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`^Bolo ${stamp}`) })).toHaveCount(0);
  await search.fill(`farinha -sal ${stamp}`);
  await expect(page.getByRole('button', { name: new RegExp(`^Bolo ${stamp}`) })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`^Pão ${stamp}`) })).toHaveCount(0);

  // A busca vira favorito e abre a paleta já com ela
  prefs = savedPrefs(page);
  await page.getByRole('button', { name: /Salvar a busca .* nos favoritos/ }).click();
  await prefs;
  await page.reload();
  const savedSearch = page.getByRole('button', { name: `Buscar farinha -sal ${stamp}` });
  await savedSearch.first().click();
  await expect(search).toHaveValue(`farinha -sal ${stamp}`);
  await page.getByRole('button', { name: new RegExp(`^Bolo ${stamp}`) }).click();
  await expect(page.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue(
    `Bolo ${stamp}`,
  );

  // Tirar dos favoritos pelo ×
  await page.goto('/notas');
  prefs = savedPrefs(page);
  await page.getByRole('button', { name: `Tirar Pão ${stamp} dos favoritos` }).first().click();
  await prefs;
  await expect(page.getByRole('link', { name: `Pão ${stamp}` }).first()).toBeVisible();
  await expect(
    page.getByRole('button', { name: `Tirar Pão ${stamp} dos favoritos` }),
  ).toHaveCount(0);

  // Aleatória: abre uma das anotações
  await page.getByRole('button', { name: 'Anotação aleatória' }).click();
  await expect(page).toHaveURL(/\/nota\//);
  await expect(page.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue(
    new RegExp(`(Pão|Bolo) ${stamp}`),
  );

  // Tela dividida (só no computador): a outra anotação ao lado, e fechar
  if (desktop) {
    await page.goto(`/notas`);
    await page.getByRole('link', { name: new RegExp(`^Pão ${stamp}`) }).last().click();
    await page.getByRole('button', { name: 'Mais opções da anotação' }).click();
    await page.getByRole('menuitem', { name: 'Abrir ao lado' }).click();
    await page.getByRole('textbox', { name: 'Procurar anotação ou lista' }).fill(`Bolo ${stamp}`);
    await page.getByRole('button', { name: new RegExp(`Bolo ${stamp}`) }).click();
    const side = page.getByTestId('side-pane');
    await expect(side.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue(
      `Bolo ${stamp}`,
    );
    await expect(page).toHaveURL(new RegExp(`lado=n%3A${second}|lado=n:${second}`));
    await page.reload();
    await expect(side.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue(
      `Bolo ${stamp}`,
    );
    await side.getByRole('button', { name: 'Fechar o lado' }).first().click();
    await expect(side).toHaveCount(0);
  }
});
