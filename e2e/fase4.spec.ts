import { devices, expect, test, type Browser, type Page } from '@playwright/test';

import { openTab, signUp } from './helpers';

/** Abre o link de convite num navegador novo, cria a conta ali mesmo e entra no projeto. */
async function joinByLink(
  browser: Browser,
  link: string,
  name: string,
  device: (typeof devices)[string],
) {
  const context = await browser.newContext({ ...device });
  const page = await context.newPage();
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Churrasco' })).toBeVisible();
  await page.getByPlaceholder('Seu nome').fill(name);
  await page
    .getByPlaceholder('E-mail')
    .fill(`e2e-convite-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@teste.local`);
  await page.getByPlaceholder('Senha').fill('senha-forte-123');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.getByRole('button', { name: 'Participar' }).click();
  return page;
}

async function claimAndOpenMine(page: Page, pendingName: string) {
  await page.getByRole('button', { name: `Sou @${pendingName}` }).click();
  await expect(page.getByRole('heading', { name: '🍖 Churrasco' })).toBeVisible();
  // O projeto abre por cima das abas; no celular, a barra de baixo volta com o "Voltar"
  await page.getByRole('button', { name: 'Voltar' }).click();
  await openTab(page, 'Minhas tarefas');
}

test('critério de aceite: Churrasco por modelo, @nomes antes de convidar, 2 convidados e tempo real', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'celular',
    'O teste já abre um navegador de celular por conta própria',
  );
  test.setTimeout(90_000);

  // Ana cria o projeto pelo modelo
  await signUp(page, testInfo);
  await openTab(page, 'Pastas');
  await page.getByRole('button', { name: 'Usar modelo' }).click();
  await page.getByRole('button', { name: 'Modelo Churrasco' }).click();
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name: '🍖 Churrasco' })).toBeVisible();
  await expect(page.getByText('👥 Projeto ·').last()).toBeVisible();

  // Cola a lista com @nomes de quem ainda não está no app
  await page.getByRole('link', { name: '🛒 Compras' }).first().click();
  await expect(page.getByRole('heading', { name: '🛒 Compras' })).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('carne @gregory; cerveja @cris; carvão; gelo');
  await input.press('Enter');
  await expect(page.getByText('4 tarefas serão criadas')).toBeVisible();
  await expect(page.getByText('@gregory · pendente')).toBeVisible();
  await expect(page.getByText('@cris · pendente')).toBeVisible();
  const created = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  await page.getByRole('button', { name: 'Criar 4' }).click();
  await created;
  await expect(page.getByText('@gregory', { exact: true }).first()).toBeVisible();

  // Gera o link de convite
  await page.getByRole('button', { name: 'Voltar' }).click();
  await page.getByRole('button', { name: '👥 Pessoas' }).click();
  await expect(page.getByText('@gregory', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Gerar link de convite' }).click();
  const link = (await page.getByLabel('Link de convite').textContent()) ?? '';
  expect(link).toMatch(/\/invite\/[\w-]{24}$/);
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page.getByRole('heading', { name: '🍖 Churrasco' })).toBeVisible();

  // Gregory entra pela web no computador; Cris, no celular
  const gregory = await joinByLink(browser, link, 'Gregory Souza', devices['Desktop Chrome']);
  await claimAndOpenMine(gregory, 'gregory');
  await expect(gregory.getByText('carne', { exact: true })).toBeVisible();

  const cris = await joinByLink(browser, link, 'Cris Lima', devices['Pixel 7']);
  await claimAndOpenMine(cris, 'cris');
  await expect(cris.getByText('cerveja', { exact: true })).toBeVisible();

  // A Ana vê os dois entrarem, sem recarregar
  await expect(page.getByText('Gregory Souza entrou no projeto')).toBeVisible();
  await expect(page.getByText('Cris Lima entrou no projeto')).toBeVisible();

  // Progresso em tempo real: Gregory e Cris marcam, a Ana vê mudar
  await expect(page.getByLabel('Gregory Souza: 0 de 1')).toBeVisible();
  await gregory.getByRole('checkbox', { name: 'Concluir carne' }).click();
  await expect(page.getByLabel('Gregory Souza: 1 de 1')).toBeVisible();
  await expect(page.getByText('Gregory Souza concluiu "carne"')).toBeVisible();

  await cris.getByRole('checkbox', { name: 'Concluir cerveja' }).click();
  await expect(page.getByLabel('Cris Lima: 1 de 1')).toBeVisible();

  // Desfazer também chega em tempo real
  await cris.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByLabel('Cris Lima: 0 de 1')).toBeVisible();

  // Ana recebe avisos de quem entrou
  await page
    .getByRole('link', { name: /Notificações: \d+ novas/ })
    .first()
    .click();
  await expect(page.getByText('Gregory Souza entrou em Churrasco')).toBeVisible();

  await gregory.context().close();
  await cris.context().close();
});

test('leitor só vê e comenta; @menção avisa', async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Um navegador de cada já cobre o celular acima');
  await signUp(page, testInfo);
  await openTab(page, 'Pastas');
  await page.getByRole('button', { name: 'Usar modelo' }).click();
  await page.getByRole('button', { name: 'Modelo Churrasco' }).click();
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await page.getByRole('button', { name: '👥 Pessoas' }).click();
  await page.getByRole('radio', { name: 'Só vê e comenta' }).click();
  await page.getByRole('button', { name: 'Gerar link de convite' }).click();
  const link = (await page.getByLabel('Link de convite').textContent()) ?? '';

  const viewer = await joinByLink(browser, link, 'Vera Leitora', devices['Desktop Chrome']);
  await expect(viewer.getByRole('heading', { name: '🍖 Churrasco' })).toBeVisible();
  await expect(viewer.getByRole('button', { name: '+ Nova página' })).toHaveCount(0);
  await viewer.getByRole('link', { name: '🛒 Compras' }).first().click();
  await expect(viewer.getByRole('textbox', { name: 'Nova tarefa' })).toHaveAttribute(
    'placeholder',
    'Só leitura: você é leitor deste projeto',
  );
  await expect(viewer.getByRole('checkbox', { name: 'Concluir Carvão' })).toBeDisabled();

  // Comenta mencionando a dona (o nome dela no cadastro do teste é "Teste E2E")
  await viewer.getByRole('button', { name: 'Detalhes de Carvão' }).click();
  const comment = viewer.getByRole('textbox', { name: 'Novo comentário' });
  await comment.fill('Eu sei onde comprar barato, @teste');
  const sent = viewer.waitForResponse((r) => r.url().includes('/comments') && r.ok());
  await comment.press('Enter');
  await sent;
  await expect(viewer.getByText('Eu sei onde comprar barato, @teste')).toBeVisible();

  await page
    .getByRole('link', { name: /Notificações: \d+ novas/ })
    .first()
    .click();
  await expect(page.getByText(/Vera Leitora te mencionou em "Carvão"/)).toBeVisible();
  await viewer.context().close();
});
