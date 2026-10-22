import { expect, test } from '@playwright/test';

import { createPage, openTab, signUp, waitForSync } from './helpers';

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

test('teclado: Tab e Shift+Tab mudam o nível, ← e → fecham e abrem', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Teclado: desktop');
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  for (const title of ['Mudar', 'Cozinha', 'Louça']) {
    await input.fill(title);
    await input.press('Enter');
  }
  await expect(page.getByRole('checkbox', { name: 'Concluir Louça' })).toBeVisible();
  await input.press('Escape');

  // Cozinha vira filha de Mudar
  await page.keyboard.press('j');
  await page.keyboard.press('j');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Fechar subtarefas de Mudar' })).toBeVisible();
  await expect(page.getByLabel('0 de 1 subtarefas')).toBeVisible();

  // Louça também, e depois um nível abaixo (filha de Cozinha)
  await page.keyboard.press('j');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('0 de 2 subtarefas')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Fechar subtarefas de Cozinha' })).toBeVisible();

  // Shift+Tab volta um nível
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: /subtarefas de Cozinha/ })).toHaveCount(0);

  // ← vai para a mãe e fecha; → abre de novo
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('button', { name: 'Abrir subtarefas de Mudar' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Concluir Louça' })).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('checkbox', { name: 'Concluir Louça' })).toBeVisible();

  // Depois de recarregar, a árvore veio do servidor
  await waitForSync(page);
  await page.reload();
  await page.getByRole('button', { name: 'Abrir subtarefas de Mudar' }).click();
  await expect(page.getByRole('checkbox', { name: 'Concluir Cozinha' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Concluir Louça' })).toBeVisible();
});

test('estrutura: abre a árvore inteira com os códigos WBS; W liga e desliga', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Teclado: desktop');
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  await page.getByRole('button', { name: 'Adicionar várias' }).click();
  await page
    .getByRole('textbox', { name: 'Lista de tarefas' })
    .fill('Mudar\n  Cozinha\n    Louça\n  Sala\nFesta');
  await page.getByRole('button', { name: /^Criar \d+$/ }).click();
  await expect(page.getByRole('checkbox', { name: 'Concluir Festa' })).toBeVisible();

  await page.getByRole('button', { name: 'Estrutura' }).click();
  await expect(page.getByRole('checkbox', { name: 'Concluir Louça' })).toBeVisible();
  await expect(page.getByRole('button', { name: '1.1 Cozinha' })).toBeVisible();
  await expect(page.getByRole('button', { name: '1.1.1 Louça' })).toBeVisible();
  await expect(page.getByRole('button', { name: '1.2 Sala' })).toBeVisible();
  await expect(page.getByRole('button', { name: '2 Festa' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Nova tarefa' }).press('Escape');
  await page.keyboard.press('w');
  await expect(page.getByRole('button', { name: 'Cozinha', exact: true })).toBeVisible();
  await page.keyboard.press('w');
  await expect(page.getByRole('button', { name: '1.1 Cozinha' })).toBeVisible();
});

test('lote: recuo além do limite da página sobe para o último nível, com aviso', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Igual nos dois perfis');
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Casa', name: 'Curta', type: 'Lista' });
  // Página com limite de 2 níveis
  await page.getByRole('button', { name: 'Opções da página' }).click();
  await page.getByRole('menuitem', { name: 'Configurar página' }).click();
  await page
    .getByRole('radiogroup', { name: 'Níveis de subtarefa' })
    .getByRole('radio', { name: '2', exact: true })
    .click();
  await page.getByRole('button', { name: 'Salvar' }).click();

  await page.getByRole('button', { name: 'Adicionar várias' }).click();
  await page.getByRole('textbox', { name: 'Lista de tarefas' }).fill('Mudar\n  Cozinha\n    Louça');
  await expect(
    page.getByText('1 item passaria de 2 níveis e ficou no último nível.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Criar 3' }).click();

  await page.getByRole('button', { name: 'Estrutura' }).click();
  await expect(page.getByRole('button', { name: '1.1 Cozinha' })).toBeVisible();
  await expect(page.getByRole('button', { name: '1.2 Louça' })).toBeVisible();
});

test('limite: baixar abaixo do que já existe é recusado e diz quais tarefas passam', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Igual nos dois perfis');
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Obra', name: 'Etapas', type: 'Lista' });
  await page.getByRole('button', { name: 'Adicionar várias' }).click();
  await page
    .getByRole('textbox', { name: 'Lista de tarefas' })
    .fill('Banheiro\n  Piso\n    Rejunte');
  await page.getByRole('button', { name: 'Criar 3' }).click();
  await expect(page.getByLabel('0 de 1 subtarefas').first()).toBeVisible();
  await waitForSync(page);

  await page.getByRole('button', { name: 'Opções da página' }).click();

  await page.getByRole('menuitem', { name: 'Configurar página' }).click();
  await page
    .getByRole('radiogroup', { name: 'Níveis de subtarefa' })
    .getByRole('radio', { name: '2', exact: true })
    .click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText(/"Rejunte" \(nível 3\)/)).toBeVisible({ timeout: 15_000 });

  // A árvore continua inteira
  await page.reload();
  await page.getByRole('button', { name: 'Estrutura' }).click();
  await expect(page.getByRole('button', { name: '1.1.1 Rejunte' })).toBeVisible();
});
