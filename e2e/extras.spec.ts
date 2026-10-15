import { expect, test } from '@playwright/test';

import { openTab, shown, signUp } from './helpers';

test('adiar: um toque leva para amanhã (sai da Hoje), Desfazer volta; Z na selecionada', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Pagar boleto hoje');
  await input.press('Enter');
  await input.fill('Ligar para o banco hoje');
  await input.press('Enter');

  await page.getByRole('button', { name: 'Adiar Pagar boleto para amanhã' }).click();
  const toast = page.getByRole('alert').filter({ hasText: 'Pagar boleto: adiada para Amanhã' });
  await expect(toast).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Concluir Pagar boleto' })).toHaveCount(0);
  await toast.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByRole('checkbox', { name: 'Concluir Pagar boleto' })).toBeVisible();

  if (testInfo.project.name === 'celular') return;
  await page.locator('body').click({ position: { x: 600, y: 600 } });
  await page.keyboard.press('j');
  await page.keyboard.press('z');
  await expect(page.getByRole('alert').filter({ hasText: /: adiada para Amanhã/ })).toBeVisible();
  await openTab(page, 'Início');
  await expect(shown(page, 'Próximos 7 dias').first()).toBeVisible();
});

test('eu levo: em projeto, tarefa sem responsável vira minha num toque', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Projeto pelo menu Novo (Alt+N)');
  await signUp(page, testInfo);
  await page.keyboard.press('Alt+n');
  await page.keyboard.press('j');
  await page.getByPlaceholder('Nome (ex.: Churrasco do sábado)').fill('Churrasco');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Churrasco' })).toBeVisible();
  await page.getByRole('button', { name: 'Nova lista' }).click();
  await page.getByPlaceholder('Nome (ex.: Treino A)').fill('Compras');
  await page.getByRole('button', { name: 'Salvar' }).click();
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Carvão');
  await input.press('Enter');

  await page.getByRole('button', { name: 'Eu levo: Carvão' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Carvão é sua.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Eu levo: Carvão' })).toHaveCount(0);
  await expect(page.getByLabel(/^Responsáveis: /)).toBeVisible();
});
