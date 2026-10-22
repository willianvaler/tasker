import { expect, test } from '@playwright/test';

import { adminRest, openTab, signUp, openSettings } from './helpers';

const userIdOf = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    return JSON.parse(localStorage.getItem(key ?? '') ?? '{}').user?.id as string;
  });

// V5 §4 (LGPD; D213): aceite no cadastro, termos públicos, aceite de conta antiga e pedido do titular
test('LGPD: cadastro exige o aceite, que fica registrado; pedido do titular', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'basta um perfil');
  // Sem marcar a caixa, não cria a conta
  await page.goto('/');
  await page.getByText('Não tenho conta').click();
  await page.getByPlaceholder('Seu nome').fill('Sem aceite');
  await page.getByPlaceholder('E-mail').fill(`lgpd-${Date.now()}@teste.local`);
  await page.getByPlaceholder('Senha').fill('senha-forte-123');
  await expect(page.getByRole('button', { name: 'Criar conta' })).toBeDisabled();
  // Os termos abrem sem login
  await page.getByRole('link', { name: 'Termos de uso' }).click();
  await expect(page.getByText('Quem pode usar')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar' }).click();

  await signUp(page, testInfo);
  await openSettings(page);
  await expect(page.getByText(/Termos aceitos: versão \d{4}-\d{2}-\d{2}/)).toBeVisible();
  await page.getByRole('button', { name: 'Pedido sobre meus dados' }).click();
  await page.getByRole('menuitem', { name: 'Corrigir dados' }).click();
  await page.getByPlaceholder('Conte o que precisa (opcional)').fill('Meu nome está errado');
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page.getByText(/Em aberto · resposta até/)).toBeVisible();

  // Conta de antes dos termos: pede o aceite ao abrir
  const me = await userIdOf(page);
  await adminRest(`consents?user_id=eq.${me}`, { method: 'DELETE' });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Termos de uso e privacidade' })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Li e aceito' }).click();
  await expect(page.getByRole('heading', { name: 'Termos de uso e privacidade' })).toHaveCount(0);
});
