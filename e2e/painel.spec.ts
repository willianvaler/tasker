import { expect, test } from '@playwright/test';

import { openTab, signUp } from './helpers';

// U2 (D158): painel simples por padrão; o seletor troca para completo e a escolha fica.
// Sem o storageState da configuração (que deixa os outros testes no Completo)
test.use({ storageState: { cookies: [], origins: [] } });

test('painel da tarefa: simples, completo e o que a tarefa já usa', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  const title = `Painel ${testInfo.project.name} ${Date.now()}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(title);
  await input.press('Enter');
  await page.getByRole('button', { name: `Detalhes de ${title}` }).click();

  // Simples: o essencial, sem tempo nem peso
  await expect(page.getByRole('button', { name: 'Adicionar descrição' })).toBeVisible();
  await expect(page.getByText('Peso', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Estimativa' })).toHaveCount(0);

  // Troca pelo seletor do topo
  await page.getByRole('button', { name: /^Painel: Simples/ }).click();
  await page.getByRole('menuitem', { name: /^Completo/ }).click();
  await expect(page.getByText('Peso', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Estimativa' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Estimativa' }).fill('45min');
  await page.getByRole('textbox', { name: 'Estimativa' }).press('Enter');

  // Volta para o simples: a estimativa que a tarefa já tem continua à vista
  await page.getByRole('button', { name: /^Painel: Completo/ }).click();
  await page.getByRole('menuitem', { name: /^Simples/ }).click();
  await expect(page.getByRole('textbox', { name: 'Estimativa' })).toBeVisible();
  await expect(page.getByText('Peso', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Mostrar tudo/ })).toBeVisible();
});
