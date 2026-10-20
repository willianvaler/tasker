import { devices, expect, test } from '@playwright/test';

import { adminRest, signUp } from './helpers';

test('visibilidade: perfil mostra pública e de amigos, nunca a privada', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'celular',
    'O teste abre o segundo navegador por conta própria',
  );
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  const stamp = Date.now().toString(36);
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  for (const line of [`Correr ${stamp} +publica`, `Ler ${stamp} +amigos`, `Segredo ${stamp}`]) {
    await input.fill(line);
    await input.press('Enter');
  }
  await expect(page.getByRole('checkbox', { name: `Concluir Segredo ${stamp}` })).toBeVisible();
  // O marcador aparece na linha
  await expect(page.getByLabel('Pública').first()).toBeVisible();
  await expect
    .poll(async () => (await adminRest(`tasks?title=like.*${stamp}&select=visibility`)).length, {
      timeout: 20_000,
    })
    .toBe(3);

  await page.goto('/amigos');
  const nick = await page.getByRole('textbox', { name: 'Seu nick' }).inputValue();
  await expect(page.getByLabel('Seu link de amizade')).toContainText('/amigo/');
  const link = (await page.getByLabel('Seu link de amizade').textContent()) ?? '';

  const context = await browser.newContext({ ...devices['Desktop Chrome'] });
  const bia = await context.newPage();
  await bia.goto(link);
  await bia.getByPlaceholder('Seu nome').fill('Bia Reis');
  await bia
    .getByPlaceholder('E-mail')
    .fill(`e2e-vis-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@teste.local`);
  await bia.getByPlaceholder('Senha').fill('senha-forte-123');
  await bia.getByRole('checkbox', { name: /aceito os Termos/ }).click();
  await bia.getByRole('button', { name: 'Criar conta' }).click();
  await bia.getByRole('button', { name: 'Aceitar amizade' }).click();
  await expect(bia.getByText(/agora são amigos/)).toBeVisible();

  await bia.goto('/');
  await bia.getByRole('button', { name: 'Pular introdução' }).click();
  await bia.goto(`/pessoa?nick=${encodeURIComponent(nick)}`);
  await expect(bia.getByText(`Correr ${stamp}`)).toBeVisible({ timeout: 15_000 });
  await expect(bia.getByText(`Ler ${stamp}`)).toBeVisible();
  await expect(bia.getByText(`Segredo ${stamp}`)).toHaveCount(0);
  await expect(bia.getByText('Vocês são amigos.')).toBeVisible();
  await context.close();
});
