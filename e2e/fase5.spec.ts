import { devices, expect, test } from '@playwright/test';

import { ageTask, openTab, shown, signUp } from './helpers';

test('fila offline: cria e marca sem internet, envia ao voltar', async ({
  page,
  context,
}, testInfo) => {
  await signUp(page, testInfo);
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  const created = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  await input.fill('Antes de cair');
  await input.press('Enter');
  await created;

  await context.setOffline(true);
  await expect(page.getByText(/Sem conexão\. Dá para criar, marcar e reordenar/)).toBeVisible();
  await input.fill('Feita offline');
  await input.press('Enter');
  await page.getByRole('checkbox', { name: 'Concluir Antes de cair' }).click();
  await expect(page.getByText('Feita offline', { exact: true })).toBeVisible();
  await expect(page.getByText(/2 alterações esperando/)).toBeVisible();

  // O resto continua só leitura sem conexão
  await openTab(page, 'Pastas');
  await expect(page.getByRole('button', { name: '+ Nova pasta' })).toBeDisabled();
  await openTab(page, 'Hoje');

  // Volta a internet: a fila vai na ordem, e o servidor confirma depois de recarregar
  const sent = page.waitForResponse((r) => r.url().includes('/complete_task') && r.ok());
  await context.setOffline(false);
  await sent;
  await expect(page.getByText(/alteraç(ão|ões) esperando/)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: /^Hoje/ })).toBeVisible();
  await expect(page.getByText('Feita offline', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Concluir Antes de cair' })).toHaveCount(0);
});

test('clã: convite por link, boss da semana e destaques', async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'O teste já abre um navegador de celular');
  await signUp(page, testInfo);
  await openTab(page, 'Clã');
  await page.getByRole('textbox', { name: 'Nome do clã' }).fill('Os Produtivos');
  await page.getByRole('textbox', { name: 'Emoji do clã' }).fill('🛡️');
  await page.getByRole('button', { name: 'Criar clã' }).click();
  await expect(page.getByRole('heading', { name: '🛡️ Os Produtivos' })).toBeVisible();
  await expect(page.getByText('Boss da semana do clã')).toBeVisible();
  await page.getByRole('button', { name: 'Gerar link de convite' }).click();
  const link = (await page.getByLabel('Link de convite do clã').textContent()) ?? '';
  expect(link).toMatch(/\/clan-invite\/[\w-]{24}$/);

  // Amiga entra pelo celular, criando a conta no próprio convite
  const friend = await (await browser.newContext({ ...devices['Pixel 7'] })).newPage();
  await friend.goto(link);
  await expect(friend.getByRole('heading', { name: 'Os Produtivos' })).toBeVisible();
  await friend.getByPlaceholder('Seu nome').fill('Bia Amiga');
  await friend
    .getByPlaceholder('E-mail')
    .fill(`e2e-cla-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@teste.local`);
  await friend.getByPlaceholder('Senha').fill('senha-forte-123');
  await friend.getByRole('button', { name: 'Criar conta' }).click();
  await friend.getByRole('button', { name: 'Entrar no clã' }).click();
  await expect(friend.getByRole('heading', { name: '🛡️ Os Produtivos' })).toBeVisible();

  // A dona vê a amiga entrar sem recarregar
  await expect(page.getByText('Bia Amiga entrou no clã')).toBeVisible();

  // A amiga conclui uma tarefa: o boss do clã apanha e ela vira destaque
  await friend.getByRole('button', { name: 'Voltar' }).click();
  await openTab(friend, 'Hoje');
  const title = `Treinar ${Date.now()}`;
  const input = friend.getByRole('textbox', { name: 'Nova tarefa' });
  const created = friend.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  await input.fill(title);
  await input.press('Enter');
  await created;
  await ageTask(title);
  await friend.getByRole('checkbox', { name: `Concluir ${title}` }).click();
  await expect(shown(friend, /Clã: /)).toBeVisible();

  await expect(page.getByText('🏆 Destaque: Bia Amiga (10 de dano)')).toBeVisible();
  await friend.context().close();
});

test('boss de projeto com prazo: cada tarefa é um golpe', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Pastas');
  await page.getByRole('button', { name: 'Usar modelo' }).click();
  await page.getByRole('button', { name: 'Modelo Festa' }).click();
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name: '🎉 Festa' })).toBeVisible();

  await page.getByRole('button', { name: '⚔️ Chamar boss com prazo' }).click();
  await page.getByRole('button', { name: 'Em 1 semana' }).click();
  await expect(page.getByText(/faltam 12 de 12 tarefas/)).toBeVisible();

  await page.getByRole('link', { name: '🎈 Preparação' }).first().click();
  const done = page.waitForResponse((r) => r.url().includes('/complete_task') && r.ok());
  await page.getByRole('checkbox', { name: 'Concluir Bolo' }).click();
  await done;
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page.getByText(/faltam 11 de 12 tarefas/)).toBeVisible();
  await expect(page.getByText(/🏆 Destaque: .+ \(1 tarefa\)$/)).toBeVisible();
});

test('exportar os dados em JSON', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Download é igual nos dois perfis');
  await signUp(page, testInfo);
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  const created = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  await input.fill('Para exportar');
  await input.press('Enter');
  await created;

  await openTab(page, 'Perfil');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar (JSON)' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^questlist-\d{4}-\d{2}-\d{2}\.json$/);
  let text = '';
  for await (const chunk of await file.createReadStream()) text += String(chunk);
  const data = JSON.parse(text);
  expect(data.tasks.map((t: { title: string }) => t.title)).toContain('Para exportar');
});

test('excluir a conta', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Igual nos dois perfis');
  await signUp(page, testInfo);
  await openTab(page, 'Perfil');
  await page.getByRole('button', { name: 'Excluir minha conta' }).click();
  await page.getByPlaceholder('Digite EXCLUIR para confirmar').fill('excluir');
  await page.getByRole('button', { name: 'Excluir para sempre' }).click();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});
