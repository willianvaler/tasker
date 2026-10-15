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

test('peso: a subtarefa pesada conta mais no progresso da mãe', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  await page.getByRole('button', { name: 'Adicionar várias' }).click();
  await page.getByRole('textbox', { name: 'Lista de tarefas' }).fill('Mudança\n  Caixas\n  Fita');
  await page.getByRole('button', { name: 'Criar 3' }).click();

  // Pelo painel da mãe, que lista as subtarefas
  await page.getByRole('button', { name: 'Detalhes de Mudança' }).click();
  await expect(page.getByText('Pelo peso das subtarefas: 0% feito')).toBeVisible();
  await page.getByText('Caixas', { exact: true }).last().click();
  await expect(page.getByText(/^Pesa no progresso da tarefa-mãe/)).toBeVisible();
  await page.getByText('3', { exact: true }).last().click();
  await page.getByRole('checkbox').first().click();
  await page.goBack();
  await expect(page.getByText('Pelo peso das subtarefas: 75% feito')).toBeVisible({
    timeout: 15_000,
  });
});

test('Meu dia e Próxima ação', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Pagar conta hoje');
  await input.press('Enter');
  await input.fill('Ler livro');
  await input.press('Enter');

  await openTab(page, 'Hoje');
  await expect(page.getByRole('button', { name: 'Fazer agora: Pagar conta' }).last()).toBeVisible();

  // "Ler livro" (sem data) vai para o Meu dia e passa a ser a próxima ação
  await openTab(page, 'Caixa de entrada');
  await page.getByRole('button', { name: 'Detalhes de Ler livro' }).click();
  await page.getByText('Pôr no meu dia').last().click();
  await expect(page.getByText('No meu dia').last()).toBeVisible();
  await page.getByRole('button', { name: 'Voltar' }).click();
  await openTab(page, 'Hoje');
  await expect(shown(page, 'Meu dia').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fazer agora: Ler livro' }).last()).toBeVisible();
  await page.getByRole('textbox', { name: 'Tempo disponível hoje' }).last().fill('1h');
  await expect(shown(page, 'Faltam 0min de 1h disponíveis')).toBeVisible();
  await page.getByRole('button', { name: 'Tirar Ler livro do meu dia' }).last().click();
  await expect(page.getByRole('button', { name: 'Fazer agora: Pagar conta' }).last()).toBeVisible();
});
