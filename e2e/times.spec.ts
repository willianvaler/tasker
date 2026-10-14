import { devices, expect, test, type Browser } from '@playwright/test';

import { signUp } from './helpers';

async function joinTeam(browser: Browser, link: string, team: string, name: string) {
  const context = await browser.newContext({ ...devices['Desktop Chrome'] });
  const page = await context.newPage();
  await page.goto(link);
  await expect(page.getByRole('heading', { name: team })).toBeVisible();
  await page.getByPlaceholder('Seu nome').fill(name);
  await page
    .getByPlaceholder('E-mail')
    .fill(`e2e-time-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@teste.local`);
  await page.getByPlaceholder('Senha').fill('senha-forte-123');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  return page;
}

test('time: criar, convidar, projeto do time, aprovação e histórico', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Fluxo de várias pessoas: desktop basta');
  const team = `Família ${Date.now()}`;
  await signUp(page, testInfo);
  await page.goto('/teams');
  await page.getByRole('button', { name: 'Novo time' }).click();
  await page.getByPlaceholder('Nome (ex.: Família)').fill(team);
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name: team })).toBeVisible();

  await page.getByRole('button', { name: 'Novo projeto no time' }).click();
  await page.getByPlaceholder('Nome (ex.: Churrasco do sábado)').fill('Churrasco');
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Churrasco' })).toBeVisible();
  await page.goBack();

  await page.getByRole('button', { name: 'Gerar link' }).click();
  const link = (await page.getByLabel('Link de convite').textContent()) ?? '';
  expect(link).toContain('/team-invite/');

  // A Bia entra pelo link e já vê o projeto do time
  const bia = await joinTeam(browser, link, team, 'Bia do Time');
  await bia.getByRole('button', { name: 'Entrar no time' }).click();
  await expect(bia.getByRole('heading', { name: team })).toBeVisible();
  await bia.getByRole('link', { name: 'Churrasco' }).click();
  await expect(bia.getByRole('heading', { name: 'Churrasco' })).toBeVisible();

  // Com aprovação ligada, o próximo vira pedido
  await page.reload();
  await page.getByRole('switch', { name: 'Pedir aprovação para entrar' }).click();
  await expect(page.getByText(/Bia do Time entrou no time/)).toBeVisible();
  const caio = await joinTeam(browser, link, team, 'Caio Pedinte');
  await caio.getByRole('button', { name: 'Pedir para entrar' }).click();
  await expect(caio.getByText(/Pedido enviado/)).toBeVisible();

  await page.reload();
  await expect(page.getByText('quer entrar como Membro')).toBeVisible();
  await page.getByRole('button', { name: 'Aprovar' }).click();
  await expect(page.getByText('Caio Pedinte', { exact: true })).toBeVisible();

  // A Bia (Membro) não vê convites nem histórico
  await bia.goto(link.replace(/.*\/team-invite\//, '/team-invite/'));
  await bia.getByRole('button', { name: 'Abrir o time' }).click();
  await expect(bia.getByRole('button', { name: 'Gerar link' })).toHaveCount(0);
  await expect(bia.getByText('Histórico')).toHaveCount(0);

  await bia.context().close();
  await caio.context().close();
});
