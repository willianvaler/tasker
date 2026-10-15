import { expect, test } from '@playwright/test';

import { createPage, isRpc, openTab, shown, signUp, waitForSync } from './helpers';

test('repetições: "3x12" na captura, cada série conta e a última conclui; desfazer reabre', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Flexões 3x12');
  await input.press('Enter');

  const more = (done: number) =>
    page.getByRole('button', { name: `Mais uma em Flexões (${done} de 3)` });
  await expect(more(0)).toBeVisible();
  await more(0).click();
  await expect(page.getByText('Flexões: 1/3').first()).toBeVisible();
  await more(1).click();
  await expect(page.getByRole('checkbox', { name: 'Concluir Flexões' })).toBeVisible();

  // A terceira conclui (pelo servidor, com o XP de sempre) e a tarefa sai das abertas
  const done = page.waitForResponse((r) => isRpc(r, 'log_rep'));
  await more(2).click();
  await done;
  await expect(page.getByRole('checkbox', { name: 'Concluir Flexões' })).toHaveCount(0);

  // "Desfazer" do aviso volta a 2/3 e reabre
  await page.getByRole('button', { name: 'Desfazer' }).first().click();
  await expect(more(2)).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Concluir Flexões' })).toBeVisible();
  await page.getByRole('button', { name: 'Detalhes de Flexões' }).click();
  await expect(page.getByRole('radio', { name: 'Séries' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByLabel('2 de 3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Voltar' }).click();

  // Recarregar mantém a conta (vem do servidor ou do banco do aparelho)
  await waitForSync(page);
  await page.reload();
  await expect(more(2)).toBeVisible({ timeout: 15_000 });
});

test('repetições: no card, "0/2" conta a série; "x8" vira contador', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Academia', name: 'Treino A', type: 'Cards' });
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Supino 2x10 40kg');
  await input.press('Enter');

  // O "0/2" do card conta uma série; a última conclui
  await expect(shown(page, '2x10 · 40kg')).toBeVisible();
  await page.getByRole('button', { name: 'Mais uma em Supino (0 de 2)' }).click();
  await page.getByRole('button', { name: 'Mais uma em Supino (1 de 2)' }).click();
  await expect(page.getByRole('checkbox', { name: 'Supino', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  // Tocar no card reabre (e a conta volta para 1/2)
  await page.getByRole('checkbox', { name: 'Supino', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mais uma em Supino (1 de 2)' })).toBeVisible();

  // Contador: o plano muda no painel
  await input.fill('Beber água x8');
  await input.press('Enter');
  await page.getByRole('button', { name: 'Detalhes de Beber água' }).click();
  await expect(page.getByRole('radio', { name: 'Vezes' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('textbox', { name: 'Quantas' })).toHaveValue('8');
  await page.getByRole('button', { name: 'Mais uma' }).click();
  await expect(page.getByLabel('1 de 8', { exact: true })).toBeVisible();
});
