import { expect, test } from '@playwright/test';

import { createPage, isRpc, paste, signUp } from './helpers';

// Fase C (V2 §5–9): estrutura e velocidade, de preferência sem mouse.

test('menu Novo: Alt+N abre, J cria um projeto, que aparece em Projetos', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Atalhos de teclado são do computador');
  await signUp(page, testInfo);
  await page.keyboard.press('Alt+n');
  await expect(page.getByRole('menuitem', { name: 'Projeto' })).toBeVisible();
  await page.keyboard.press('j');
  await page.getByPlaceholder('Nome (ex.: Churrasco do sábado)').fill('Mudança');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Mudança' })).toBeVisible();
  // Na barra lateral, dentro da seção Projetos
  await expect(page.getByRole('navigation').getByText('Projetos', { exact: true })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Mudança' })).toBeVisible();
});

test('mover página para outra pasta leva as tarefas junto', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Casa', name: 'Consertos', type: 'Lista' });
  // No celular a página abre por cima das abas
  await page.goto('/');
  const id = await createPage(page, { folder: 'Mercado', name: 'Lista do mês', type: 'Lista' });
  await page.getByRole('textbox', { name: 'Nova tarefa' }).fill('Arroz');
  await page.getByRole('textbox', { name: 'Nova tarefa' }).press('Enter');
  await expect(page.getByText('Arroz', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Opções da página' }).click();
  await page.getByRole('menuitem', { name: 'Mover para…' }).click();
  const moved = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/pages') && r.request().method() === 'PATCH',
  );
  await page.getByRole('menuitem', { name: 'Casa', exact: true }).click();
  await moved;
  await expect(page.getByText('Movida para Casa')).toBeVisible();
  // Recarregada, a página continua com a tarefa e o caminho mostra a pasta nova
  await page.goto(`/page/${id}`);
  await expect(page.getByText('Arroz', { exact: true })).toBeVisible();
  await expect(page.getByText('Casa', { exact: true }).first()).toBeVisible();
});

test('F2: renomeia a tarefa selecionada e, sem seleção, a página (com o ícone)', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'F2 é do teclado do computador');
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Casa', name: 'Consertos', type: 'Lista' });
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Trocar lampada');
  await input.press('Enter');
  await expect(page.getByText('Trocar lampada', { exact: true })).toBeVisible();

  // Seleciona com J (o foco sai do campo com Esc) e edita com F2
  await input.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 400 } });
  await page.keyboard.press('j');
  await page.keyboard.press('F2');
  const title = page.getByRole('textbox', { name: 'Título da tarefa' });
  await expect(title).toBeFocused();
  await title.fill('Trocar lâmpada da sala');
  const saved = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/tasks') && r.request().method() === 'PATCH',
  );
  await title.press('Enter');
  await saved;
  await expect(page.getByText('Trocar lâmpada da sala', { exact: true })).toBeVisible();

  // Sem seleção, F2 renomeia a página; Tab vai para o ícone
  await page.keyboard.press('Escape');
  await page.keyboard.press('F2');
  const name = page.getByRole('textbox', { name: 'Nome', exact: true });
  await expect(name).toBeFocused();
  await name.fill('Reparos');
  await name.press('Shift+Tab');
  await page.keyboard.press('Enter');
  await page.getByRole('textbox', { name: /Buscar ícone/ }).fill('martelo');
  await page.getByRole('radio', { name: 'hammer' }).click();
  await name.press('Enter');
  await expect(page.getByRole('heading', { name: 'Reparos' })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Reparos' })).toBeVisible();
});

test('atalhos de lista: prioridade, concluir, apagar e desfazer, navegar', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Atalhos de teclado são do computador');
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Casa', name: 'Faxina', type: 'Lista' });
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.click();
  await paste(page, 'Lavar louça\nVarrer\nTirar o lixo');
  await page.getByRole('button', { name: 'Criar 3' }).click();
  await expect(page.getByText('Tirar o lixo', { exact: true })).toBeVisible();

  // N põe o foco no campo da tela; Esc sai dele
  await page.locator('body').click({ position: { x: 5, y: 500 } });
  await page.keyboard.press('n');
  await expect(input).toBeFocused();
  await input.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 500 } });

  // J seleciona a primeira; 3 dá prioridade !!!
  await page.keyboard.press('j');
  await page.keyboard.press('3');
  await expect(page.getByText('!!!', { exact: true })).toBeVisible();

  // Espaço (ou X) conclui, Ctrl+Z desfaz
  const done = page.waitForResponse((r) => isRpc(r, 'complete_task'));
  await page.keyboard.press(' ');
  await done;
  await expect(page.getByRole('checkbox', { name: 'Reabrir Lavar louça' })).toHaveCount(0);
  const undone = page.waitForResponse((r) => isRpc(r, 'uncomplete_task'));
  await page.keyboard.press('Control+z');
  await undone;
  await expect(page.getByRole('checkbox', { name: 'Concluir Lavar louça' })).toBeVisible();
  // Shift+Z refaz (conclui de novo) e Ctrl+Z desfaz outra vez
  const redone = page.waitForResponse((r) => isRpc(r, 'complete_task'));
  await page.keyboard.press('Shift+Z');
  await redone;
  await expect(page.getByRole('checkbox', { name: 'Concluir Lavar louça' })).toHaveCount(0);
  const undoneAgain = page.waitForResponse((r) => isRpc(r, 'uncomplete_task'));
  await page.keyboard.press('Control+z');
  await undoneAgain;
  await expect(page.getByRole('checkbox', { name: 'Concluir Lavar louça' })).toBeVisible();

  // Delete apaga (some na hora) e Ctrl+Z traz de volta
  await page.keyboard.press('j');
  await page.keyboard.press('Delete');
  await expect(page.getByText(/^Apagada: /)).toBeVisible();
  const gone = (await page.getByText(/^Apagada: /).textContent())!.replace('Apagada: ', '');
  await expect(page.getByText(gone, { exact: true })).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(page.getByText(gone, { exact: true })).toBeVisible();

  // G depois H vai para a Hoje; Ctrl+B esconde a barra lateral
  await page.keyboard.press('g');
  await page.keyboard.press('h');
  await expect(page.getByRole('heading', { name: 'Hoje' })).toBeVisible();
  await page.keyboard.press('Control+b');
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await page.keyboard.press('Control+b');
  await expect(page.getByRole('navigation')).toBeVisible();
});

test('paleta de comandos: Ctrl+K busca página e tarefa e abre', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Atalhos de teclado são do computador');
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Viagem', name: 'Roteiro de Lisboa', type: 'Lista' });
  const created = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  await page.getByRole('textbox', { name: 'Nova tarefa' }).fill('Comprar passagem');
  await page.getByRole('textbox', { name: 'Nova tarefa' }).press('Enter');
  await created;
  await expect(page.getByText('Comprar passagem', { exact: true })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /^Olá/ })).toBeVisible();

  // Ir para a página, sem acento e com ↓ Enter
  await page.keyboard.press('Control+k');
  const search = page.getByRole('textbox', { name: 'Buscar ou executar' });
  await search.fill('lisboa');
  await expect(
    page.getByRole('search').getByRole('button', { name: /Roteiro de Lisboa/ }),
  ).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Roteiro de Lisboa' })).toBeVisible();

  // "/" também abre; tarefa já carregada abre os detalhes
  await page.locator('body').click({ position: { x: 5, y: 500 } });
  await page.keyboard.press('/');
  await search.fill('passagem');
  await expect(
    page.getByRole('search').getByRole('button', { name: /Comprar passagem/ }),
  ).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Título', exact: true })).toHaveValue(
    'Comprar passagem',
  );
});

test('criação avançada: todos os campos e Ctrl+Enter', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  const pageId = await createPage(page, { folder: 'Casa', name: 'Reforma', type: 'Lista' });
  // Pelo botão ao lado da captura (no computador também há Alt+Shift+N)
  await page.getByRole('button', { name: 'Criação avançada' }).click();
  await page.getByRole('textbox', { name: 'Título', exact: true }).fill('Orçamento do pintor');
  await page.getByRole('textbox', { name: 'Descrição' }).fill('Pedir 3 orçamentos');
  await page.getByRole('radio', { name: '!!! Alta' }).click();
  await page.getByRole('button', { name: 'Amanhã' }).click();
  const created = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  // Notas vão pelo set_task_notes no sync, ou como update direto sem ele
  const noted = page.waitForResponse(
    (r) =>
      isRpc(r, 'set_task_notes') ||
      (r.url().includes('/rest/v1/tasks') && r.request().method() === 'PATCH' && r.ok()),
  );
  if (testInfo.project.name === 'desktop') await page.keyboard.press('Control+Enter');
  else await page.getByRole('button', { name: 'Criar tarefa' }).click();

  // Abre a tarefa criada, no painel de sempre, com o que foi preenchido
  await expect(page.getByRole('textbox', { name: 'Título', exact: true })).toHaveValue(
    'Orçamento do pintor',
  );
  await expect(page.getByRole('textbox', { name: 'Descrição' })).toHaveValue('Pedir 3 orçamentos');
  await created;
  await noted;
  await page.goto(`/page/${pageId}`);
  await expect(page.getByText('Orçamento do pintor', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Data: Amanhã')).toBeVisible();
});

test('ajuda: "?" abre a tabela de atalhos, gerada do registro, com busca', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Atalhos de teclado são do computador');
  await signUp(page, testInfo);
  await page.locator('body').click({ position: { x: 5, y: 500 } });
  await page.keyboard.press('?');
  await expect(page.getByRole('heading', { name: 'Ajuda' })).toBeVisible();
  await expect(page.getByText('Abrir o menu Novo', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: /Buscar na ajuda/ }).fill('renomear');
  await expect(page.getByLabel(/^Renomear o item selecionado.*: F2$/)).toBeVisible();
  await expect(page.getByText('Abrir o menu Novo', { exact: true })).toHaveCount(0);
});

test('aceite da Fase C: pasta, página, 10 tarefas em lote, F2 e ícone sem mouse', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'O aceite é de teclado (V2 §13, Fase C)');
  await signUp(page, testInfo);
  const kb = page.keyboard;

  // Pasta: Alt+N, F, nome, Enter (a pasta abre)
  await kb.press('Alt+n');
  await kb.press('f');
  await expect(page.getByPlaceholder('Nome (ex.: Academia)')).toBeFocused();
  await kb.type('Academia');
  await kb.press('Enter');
  await expect(page.getByRole('heading', { name: 'Academia' })).toBeVisible();

  // Página dentro dela: Alt+N, P, nome, Enter (a página abre)
  await kb.press('Alt+n');
  await kb.press('p');
  await expect(page.getByPlaceholder('Nome (ex.: Treino A)')).toBeFocused();
  await kb.type('Treino A');
  await kb.press('Enter');
  await expect(page.getByRole('heading', { name: 'Treino A' })).toBeVisible();

  // 10 tarefas coladas no campo (N põe o foco), Ctrl+Enter confirma o lote
  await kb.press('Escape');
  await kb.press('n');
  await expect(page.getByRole('textbox', { name: 'Nova tarefa' })).toBeFocused();
  await paste(page, Array.from({ length: 10 }, (_, i) => `Exercício ${i + 1}`).join('\n'));
  await expect(page.getByText('10 tarefas serão criadas')).toBeVisible();
  const created = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  await kb.press('Control+Enter');
  await created;
  await expect(page.getByText('Exercício 10', { exact: true })).toBeVisible();

  // F2 renomeia a página; Shift+Tab vai ao ícone, Enter abre o seletor, busca e escolhe
  await kb.press('Escape');
  await kb.press('F2');
  await expect(page.getByRole('textbox', { name: 'Nome', exact: true })).toBeFocused();
  await kb.press('ControlOrMeta+a');
  await kb.type('Treino de peito');
  await kb.press('Shift+Tab');
  await kb.press('Enter');
  await expect(page.getByRole('textbox', { name: /Buscar ícone/ })).toBeFocused();
  await kb.type('academia');
  await kb.press('Tab');
  await kb.press('Enter');
  await expect(page.getByRole('textbox', { name: /Buscar ícone/ })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Nome', exact: true }).focus();
  const saved = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/pages') && r.request().method() === 'PATCH',
  );
  await kb.press('Enter');
  await saved;
  await expect(page.getByRole('heading', { name: 'Treino de peito' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Treino de peito' })).toBeVisible();
  await expect(page.getByText('Exercício 1', { exact: true })).toBeVisible();
});

test('trocar um atalho na Ajuda vale na hora e volta ao de fábrica', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Atalhos de teclado são do computador');
  await signUp(page, testInfo);
  await page.goto('/ajuda');
  await page
    .getByRole('button', { name: 'Trocar a tecla de "Ir para a Caixa de entrada"' })
    .click();
  await expect(page.getByText('Aperte a nova tecla (Esc cancela)')).toBeVisible();
  // Tecla já usada por outro atalho global: avisa e não troca
  await page.keyboard.press('q');
  await expect(page.getByText(/já é de/)).toBeVisible();
  await page.keyboard.press('Alt+i');
  await expect(page.getByText('Aperte a nova tecla (Esc cancela)')).toHaveCount(0);
  await page.locator('body').click({ position: { x: 5, y: 500 } });
  await page.keyboard.press('Alt+i');
  await expect(page.getByRole('heading', { name: 'Caixa de entrada' })).toBeVisible();
  // De volta ao de fábrica (G I)
  await page.goto('/ajuda');
  await page.getByRole('button', { name: 'Voltar todos os atalhos ao padrão' }).click();
  await expect(page.getByRole('button', { name: 'Voltar todos os atalhos ao padrão' })).toHaveCount(
    0,
  );
});
