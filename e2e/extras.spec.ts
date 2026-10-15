import { expect, test } from '@playwright/test';

import { adminRest, createPage, openTab, shown, signUp } from './helpers';

test('adiar: um toque leva para amanhã (sai da Hoje), Desfazer volta; Z na selecionada', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  const title = `Pagar boleto ${testInfo.project.name} ${Date.now()}`;
  await input.fill(`${title} hoje`);
  await input.press('Enter');
  await input.fill('Ligar para o banco hoje');
  await input.press('Enter');
  // O botão de adiar aparece nas atrasadas: a tarefa passa a ter vencido ontem
  const saved = page.waitForResponse(
    (r) => r.url().includes('create_tasks_batch') || r.url().includes('powersync'),
  );
  await saved.catch(() => {});
  await expect
    .poll(
      async () => (await adminRest(`tasks?title=eq.${encodeURIComponent(title)}&select=id`)).length,
      { timeout: 20_000 },
    )
    .toBe(1);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await adminRest(`tasks?title=eq.${encodeURIComponent(title)}`, {
    method: 'PATCH',
    body: JSON.stringify({ due_date: yesterday }),
  });
  await page.reload();

  await page.getByRole('button', { name: `Adiar ${title} para amanhã` }).click({ timeout: 20_000 });
  const toast = page.getByRole('alert').filter({ hasText: `${title}: adiada para Amanhã` });
  await expect(toast).toBeVisible();
  await expect(page.getByRole('checkbox', { name: `Concluir ${title}` })).toHaveCount(0);
  await toast.getByRole('button', { name: 'Desfazer' }).click();
  // Desfazer relê a lista depois do servidor responder (no CI, mais de 5 s às vezes)
  await expect(page.getByRole('checkbox', { name: `Concluir ${title}` })).toBeVisible({
    timeout: 15_000,
  });

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
  await expect(page.getByRole('menuitem', { name: 'Projeto' })).toBeVisible();
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

  // Sem Meu dia, a sugestão aparece no Início (na Hoje seria a mesma primeira linha)
  await openTab(page, 'Início');
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
  await expect(page.getByRole('button', { name: 'Fazer agora: Ler livro' })).toHaveCount(0);
});

test('campos personalizados: moeda e seleção na página, preenchidos no painel e mostrados na linha', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Casa', name: 'Reforma', type: 'Lista' });
  await page.getByRole('button', { name: 'Opções da página' }).click();
  await shown(page, 'Campos da página…').click();
  await page.getByRole('textbox', { name: 'Nome do campo' }).fill('Valor');
  await page.getByRole('radio', { name: 'Moeda' }).click();
  await page.getByRole('button', { name: 'Adicionar campo' }).click();
  await page.getByRole('textbox', { name: 'Nome do campo' }).fill('Fase');
  await page.getByRole('radio', { name: 'Seleção' }).click();
  await page.getByRole('textbox', { name: 'Opções' }).fill('Obra, Compra');
  await page.getByRole('button', { name: 'Adicionar campo' }).click();
  await expect(page.getByRole('button', { name: 'Tirar o campo Fase' })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar' }).last().click();

  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Piso');
  await input.press('Enter');
  await page.getByRole('button', { name: 'Detalhes de Piso' }).click();
  const value = page.getByRole('textbox', { name: 'Valor', exact: true });
  await value.fill('1.200,00');
  await value.blur();
  await expect(page.getByText(/^R\$\s1\.200,00$/)).toBeVisible();
  await page.getByText('Compra', { exact: true }).last().click();
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(shown(page, /^Valor R\$\s1\.200,00 · Fase Compra$/)).toBeVisible();
});

test('automação: concluir em "Dia" cria a tarefa seguinte em "Depois"', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Projeto pelo menu Novo (Alt+N)');
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  await page.keyboard.press('Alt+n');
  await expect(page.getByRole('menuitem', { name: 'Projeto' })).toBeVisible();
  await page.keyboard.press('j');
  await page.getByPlaceholder('Nome (ex.: Churrasco do sábado)').fill('Churrasco');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Churrasco' })).toBeVisible();
  const project = page.url();
  for (const name of ['Dia', 'Depois']) {
    await page.goto(project);
    await page.getByRole('button', { name: 'Nova lista' }).click();
    await page.getByPlaceholder('Nome (ex.: Treino A)').fill(name);
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('heading', { name: new RegExp(`${name}$`) })).toBeVisible();
  }
  const depois = page.url();

  await page.goto(project);
  await page.getByRole('button', { name: 'Automações' }).click();
  await page.getByRole('radio', { name: 'Dia', exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Título da tarefa nova' }).fill('Limpar a churrasqueira');
  await page.getByRole('radio', { name: 'Depois', exact: true }).last().click();
  await page.getByRole('button', { name: 'Criar automação' }).click();
  await expect(
    page.getByText(
      'Quando uma tarefa for concluída em Dia, criar "Limpar a churrasqueira" em Depois',
    ),
  ).toBeVisible();

  await page.goto(project);
  await page.getByRole('link', { name: 'Dia' }).last().click();
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Assar a carne');
  await input.press('Enter');
  const done = page.waitForResponse(
    (r) => r.url().includes('rpc/') && r.request().postData()?.includes('complete_task') === true,
  );
  await page.getByRole('checkbox', { name: 'Concluir Assar a carne' }).click();
  await done;
  await page.goto(depois);
  await expect(page.getByRole('checkbox', { name: 'Concluir Limpar a churrasqueira' })).toBeVisible(
    { timeout: 20_000 },
  );
});

test('aprovação: a tarefa mostra quem aprova e quem pode, conclui', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Projeto pelo menu Novo (Alt+N)');
  await signUp(page, testInfo);
  await page.keyboard.press('Alt+n');
  await expect(page.getByRole('menuitem', { name: 'Projeto' })).toBeVisible();
  await page.keyboard.press('j');
  await page.getByPlaceholder('Nome (ex.: Churrasco do sábado)').fill('Reforma');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Nova lista' }).click();
  await page.getByPlaceholder('Nome (ex.: Treino A)').fill('Compras');
  await page.getByRole('button', { name: 'Salvar' }).click();
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Aprovar orçamento');
  await input.press('Enter');

  await page.getByRole('button', { name: 'Detalhes de Aprovar orçamento' }).click();
  await page.getByRole('radio', { name: 'Só o Dono' }).click();
  await expect(page.getByRole('radio', { name: 'Só o Dono' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(shown(page, 'Aprovação · Só o Dono')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Concluir Aprovar orçamento' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: /Concluída: Aprovar orçamento/ }),
  ).toBeVisible();
});
