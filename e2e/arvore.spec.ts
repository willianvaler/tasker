import { expect, test } from '@playwright/test';

import { openTab, signUp } from './helpers';

test('árvore: progresso pelas folhas, "Concluir tudo" e mãe que fecha sozinha', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  await page.getByRole('button', { name: 'Adicionar várias' }).click();
  await page
    .getByRole('textbox', { name: 'Lista de tarefas' })
    .fill('Mudança\n  Caixas\n  Fita\nArrumar\n  Sala\n  Quarto');
  await page.getByRole('button', { name: 'Criar 6' }).click();
  await expect(page.getByLabel('0 de 2 subtarefas').first()).toBeVisible();

  // Mãe com filhas abertas: pede confirmação e conclui o galho inteiro
  await page.getByRole('checkbox', { name: 'Concluir Mudança' }).click();
  await expect(page.getByText('Concluir "Mudança" e tudo dentro dela?')).toBeVisible();
  await expect(page.getByText('2 subtarefas abertas também serão concluídas.')).toBeVisible();
  await page.getByRole('button', { name: 'Concluir tudo' }).click();
  await expect(page.getByRole('checkbox', { name: 'Concluir Mudança' })).toHaveCount(0);

  // Concluir as duas filhas fecha a mãe sozinha
  await page.getByRole('button', { name: 'Detalhes de Arrumar' }).click();
  await page.getByRole('checkbox', { name: 'Sala', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Quarto', exact: true }).click();
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page.getByRole('checkbox', { name: 'Concluir Arrumar' })).toHaveCount(0, {
    timeout: 15_000,
  });
});

test('estimativa: "90m" vira 1h30 e fica salva; a mãe mostra a soma', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  await page.getByRole('button', { name: 'Adicionar várias' }).click();
  await page
    .getByRole('textbox', { name: 'Lista de tarefas' })
    .fill('Pintar\n  Sala\nComprar tinta');
  await page.getByRole('button', { name: 'Criar 3' }).click();

  await page.getByRole('button', { name: 'Detalhes de Comprar tinta' }).click();
  const field = page.getByRole('textbox', { name: 'Estimativa' });
  await field.fill('90m');
  await field.press('Enter');
  await expect(field).toHaveValue('1h30');
  await page.getByRole('button', { name: 'Voltar' }).click();
  await page.getByRole('button', { name: 'Detalhes de Comprar tinta' }).click();
  await expect(page.getByRole('textbox', { name: 'Estimativa' })).toHaveValue('1h30');
  await page.getByRole('button', { name: 'Voltar' }).click();

  // Mãe: estimativa é só leitura
  await page.getByRole('button', { name: 'Detalhes de Pintar' }).click();
  await expect(page.getByText('Sem estimativa nas subtarefas')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Estimativa' })).toHaveCount(0);
});
