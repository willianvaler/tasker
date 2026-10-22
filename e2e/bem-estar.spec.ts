import { expect, test } from '@playwright/test';

import { openSettings, openTab, shown, signUp } from './helpers';

// Bem-estar (D270): remédios com o saldo do que falta, e a Academia dentro do Bem-estar.

test('remédios: consentimento, novo, saldo e "Comprei"', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Bem-estar');
  await expect(page.getByRole('heading', { name: 'Bem-estar' })).toBeVisible();

  await page.getByRole('button', { name: 'Concordo e quero registrar remédios' }).click();
  await page.getByRole('button', { name: 'Novo remédio' }).click();
  const name = `Losartana ${Date.now()}`;
  await page.getByRole('textbox', { name: 'Nome (ex.: Losartana 50 mg)' }).fill(name);
  await page.getByRole('radio', { name: '2× por dia' }).click();
  await page.getByRole('textbox', { name: 'Comprimidos por caixa' }).fill('30');
  // "Quantos você tem agora" vazio vale uma caixa
  const saved = page.waitForResponse((r) => r.url().includes('medications') && r.ok());
  await page.getByRole('button', { name: 'Salvar' }).click();
  await saved;
  await expect(shown(page, name)).toBeVisible();
  await expect(shown(page, '1 comprimido · 2× por dia · Todo dia')).toBeVisible();
  await expect(shown(page, /Restam 30 comprimidos · dá até .* \(15 dias\)/)).toBeVisible();

  // Comprei: a caixa já vem preenchida e soma ao que resta
  await page.getByRole('button', { name: `Comprei ${name}` }).click();
  const bought = page.waitForResponse((r) => r.url().includes('medications') && r.ok());
  await page.getByRole('button', { name: 'Somar' }).click();
  await bought;
  await expect(shown(page, /Restam 60 comprimidos · dá até .* \(30 dias\)/)).toBeVisible();

  await page.reload();
  await expect(shown(page, /Restam 60 comprimidos/)).toBeVisible();
});

test('Academia dentro do Bem-estar', async ({ page }, testInfo) => {
  const desktop = testInfo.project.name === 'desktop';
  await signUp(page, testInfo);
  await openSettings(page);
  const on = page.waitForResponse((r) => r.url().includes('/rpc/set_gym_mode'));
  await page.getByRole('switch', { name: 'Treino (academia)' }).click();
  await on;
  await page.getByRole('switch', { name: 'Academia dentro do Bem-estar' }).click();
  await expect(page.getByRole('switch', { name: 'Academia dentro do Bem-estar' })).toBeChecked();
  if (desktop) {
    // O bloco Academia sai da barra lateral
    await expect(
      page.getByRole('navigation').getByRole('button', { name: 'Novo treino' }),
    ).toHaveCount(0);
  }

  await openTab(page, 'Bem-estar');
  await expect(page.getByRole('link', { name: 'Começar um treino' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar o primeiro treino' })).toBeVisible();
});
