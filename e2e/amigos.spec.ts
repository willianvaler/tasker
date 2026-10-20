import { devices, expect, test } from '@playwright/test';

import { signUp } from './helpers';

test('amigos: pelo link vira amizade na hora; desfazer; pedido por nick e aceite', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'celular',
    'O teste abre o segundo navegador por conta própria',
  );
  test.setTimeout(90_000);

  await signUp(page, testInfo);
  await page.goto('/amigos');
  const nickInput = page.getByRole('textbox', { name: 'Seu nick' });
  await expect(nickInput).not.toHaveValue('');
  const anaNick = `ana${Date.now().toString(36)}`;
  await nickInput.fill(anaNick);
  await page.getByRole('button', { name: 'Salvar nick' }).click();
  await expect(page.getByText(`Agora você é @${anaNick}.`)).toBeVisible();
  const link = (await page.getByLabel('Seu link de amizade').textContent()) ?? '';
  expect(link).toMatch(/\/amigo\/[\w-]+$/);

  // Bia abre o link, cria a conta e aceita
  const context = await browser.newContext({ ...devices['Desktop Chrome'] });
  const bia = await context.newPage();
  await bia.goto(link);
  await expect(bia.getByRole('heading', { name: /quer ser seu amigo no Questlist/ })).toBeVisible();
  await bia.getByPlaceholder('Seu nome').fill('Bia Reis');
  await bia
    .getByPlaceholder('E-mail')
    .fill(`e2e-amigo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@teste.local`);
  await bia.getByPlaceholder('Senha').fill('senha-forte-123');
  await bia.getByRole('checkbox', { name: /aceito os Termos/ }).click();
  await bia.getByRole('button', { name: 'Criar conta' }).click();
  await bia.getByRole('button', { name: 'Aceitar amizade' }).click();
  await expect(bia.getByText(/agora são amigos/)).toBeVisible();

  // Ana vê a Bia (tempo real) e desfaz
  await expect(page.getByRole('button', { name: 'Desfazer amizade com Bia Reis' })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Desfazer amizade com Bia Reis' }).click();
  await page.getByRole('button', { name: 'Desfazer amizade', exact: true }).click();
  await expect(page.getByText('Nenhum amigo ainda.')).toBeVisible();

  // Bia pede de novo pelo nick da Ana; Ana aceita
  // Conta nova: passa a introdução antes
  await bia.goto('/');
  await bia.getByRole('button', { name: 'Pular introdução' }).click();
  await bia.goto('/amigos');
  // Espera a tela carregar (o perfil traz o nick) antes de digitar
  await expect(bia.getByRole('textbox', { name: 'Seu nick' })).not.toHaveValue('', {
    timeout: 15_000,
  });
  await bia.getByRole('textbox', { name: /Nick ou e-mail/ }).fill(`@${anaNick}`);
  await bia.getByRole('button', { name: 'Pedir amizade' }).click();
  await expect(bia.getByText(`Pedido enviado para @${anaNick}.`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aceitar o pedido de Bia Reis' })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Aceitar o pedido de Bia Reis' }).click();
  await expect(page.getByRole('button', { name: 'Desfazer amizade com Bia Reis' })).toBeVisible();
  await context.close();
});
