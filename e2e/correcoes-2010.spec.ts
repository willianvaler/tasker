import { expect, test } from '@playwright/test';

import { openTab, shown, signUp } from './helpers';

// Correções do dono (20/10): arrastar no kanban, apagar a página aberta (no treino da Academia
// não havia como), anotações dentro de pastas e projetos, e o login no topo da tela no celular.

async function newFolderPage(
  page: import('@playwright/test').Page,
  mobile: boolean,
  kanban = false,
) {
  await page
    .getByRole('button', { name: 'Nova pasta' })
    .or(page.getByRole('tab', { name: 'Pastas' }))
    .first()
    .click();
  if (mobile) await page.getByRole('button', { name: 'Nova pasta' }).click();
  const folder = `Pasta ${Date.now()}`;
  await page.getByPlaceholder('Nome (ex.: Academia)').fill(folder);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.getByRole('button', { name: 'Criar a primeira lista' }).click();
  await page.getByPlaceholder('Nome (ex.: Treino A)').fill('Quadro');
  if (kanban) await page.getByRole('radio', { name: /Quadro/ }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { name: 'Quadro' })).toBeVisible();
  return folder;
}

test('kanban: arrastar o card para outra coluna', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Arrasto com mouse; no celular é toque longo');
  await signUp(page, testInfo);
  await newFolderPage(page, false, true);
  const title = `Arrastar ${Date.now()}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(title);
  await input.press('Enter');
  const card = page.getByLabel('Coluna A fazer').getByText(title);
  await expect(card).toBeVisible();

  const from = await card.boundingBox();
  const to = await page.getByLabel('Coluna Fazendo').boundingBox();
  if (!from || !to) throw new Error('sem posição');
  await page.mouse.move(from.x + 10, from.y + 5);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + 10, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + 40, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByLabel('Coluna Fazendo').getByText(title)).toBeVisible({
    timeout: 10_000,
  });
  // Arrastar pelo título não abre a tarefa depois de soltar, nem clicar nele; editar é pelo lápis
  await expect(page).not.toHaveURL(/\/task\//);
  await page.getByLabel('Coluna Fazendo').getByText(title).click();
  await expect(page).not.toHaveURL(/\/task\//);
  await page.getByRole('button', { name: `Detalhes de ${title}` }).click();
  await expect(page).toHaveURL(/\/task\//);
});

test('Hoje: a lista continua atrás do painel da tarefa', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  const title = `Fundo ${Date.now()}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(title);
  await input.press('Enter');
  const row = page.locator(`text=${title}`).first();
  await expect(row).toBeVisible();
  await page.getByRole('button', { name: `Detalhes de ${title}` }).click();
  await expect(page).toHaveURL(/\/task\//);
  // A linha da Hoje (e o título da tela) ficam desenhados atrás do painel
  await expect(page.locator('text=/^Hoje/').first()).toBeVisible();
  await expect(page.locator(`text=${title}`).first()).toBeVisible();
});

test('apagar a página aberta e anotação dentro da pasta', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Igual nos dois perfis');
  await signUp(page, testInfo);
  const folder = await newFolderPage(page, false);

  // A página aberta tem "Apagar página" no menu
  await page.getByRole('button', { name: 'Opções da lista' }).click();
  await page.getByRole('menuitem', { name: 'Apagar lista' }).click();
  await page.getByRole('button', { name: 'Apagar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Quadro' })).toHaveCount(0);

  // Na pasta, a seção Anotações cria uma anotação da pasta (não aparece nas pessoais)
  await page.getByRole('link', { name: folder }).first().click();
  await page.getByRole('button', { name: 'Nova anotação' }).first().click();
  const editor = page.getByRole('textbox').first();
  await editor.fill('Combinado da pasta');
  await page.goBack();
  await expect(shown(page, 'Combinado da pasta')).toBeVisible({ timeout: 15_000 });
});

test('login: no celular o formulário vem primeiro', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'celular', 'O caso é a tela do celular');
  await page.goto('/sign-in');
  const email = page.getByRole('textbox', { name: /e-mail/i }).first();
  await expect(email).toBeVisible();
  const box = await email.boundingBox();
  // No topo da tela, acima da metade (o teclado cobre a parte de baixo)
  expect(box && box.y).toBeLessThan((page.viewportSize()?.height ?? 800) / 2);
});
