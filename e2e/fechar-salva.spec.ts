import { expect, test } from '@playwright/test';

import { openTab, signUp } from './helpers';

// W6: clicar fora do painel fecha e salva o que estava sendo digitado (sem sair do campo antes).
test('clicar fora do painel fecha e salva', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  const title = `Fechar ${testInfo.project.name} ${Date.now()}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(title);
  await input.press('Enter');
  await page.getByRole('button', { name: `Detalhes de ${title}` }).click();
  await page.getByRole('button', { name: 'Adicionar descrição' }).click();
  await page.getByRole('textbox', { name: 'Descrição' }).pressSequentially('Ligar antes das 18h');
  await page.getByRole('textbox', { name: 'Título', exact: true }).fill(`${title} ok`);

  // Clica fora do painel: no computador, na área da lista à esquerda dele (depois da barra
  // lateral); no celular, no fundo escuro de cima
  if (testInfo.project.name === 'desktop') await page.mouse.click(420, 600);
  else await page.mouse.click(20, 30);
  await expect(page.getByRole('textbox', { name: 'Descrição' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: `Detalhes de ${title} ok` })).toBeVisible();

  await page.getByRole('button', { name: `Detalhes de ${title} ok` }).click();
  await expect(page.getByRole('textbox', { name: 'Descrição' })).toHaveValue('Ligar antes das 18h');
});
