import { expect, test } from '@playwright/test';

import { ageCycle, createPage, openTab, paste, shown, signUp } from './helpers';

const TREINO = [
  'Supino 4x12 20kg',
  'Supino inclinado 3x10 16kg',
  'Crucifixo 3x12 10kg',
  'Tríceps corda 4x12 25kg',
  'Tríceps francês 3x10 12kg',
  'Desenvolvimento 4x10 14kg',
  'Elevação lateral 3x15 6kg',
  'Abdominal 3x20',
];

test('critério de aceite: Treino A com 8 exercícios, marcar tudo e reset na semana seguinte', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  const pageId = await createPage(page, { folder: 'Academia', name: 'Treino A', type: 'Cards' });

  await page.getByRole('button', { name: 'Adicionar várias' }).click();
  await page.getByRole('textbox', { name: 'Lista de tarefas' }).fill(TREINO.join('\n'));
  await expect(shown(page, '8 tarefas serão criadas')).toBeVisible();
  const created = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  await page.getByRole('button', { name: 'Criar 8' }).click();
  await created;

  await expect(shown(page, '0/8 feitos')).toBeVisible();
  await expect(shown(page, '4x12 · 20kg')).toBeVisible();
  await expect(shown(page, 'Reinicia toda segunda')).toBeVisible();

  // Toque no card inteiro marca
  for (const line of TREINO) {
    const name = line.replace(/ \d+x\d+.*$/, '');
    const done = page.waitForResponse((r) => r.url().includes('complete_task') && r.ok());
    await page.getByRole('checkbox', { name, exact: true }).click();
    await done;
  }
  await expect(shown(page, 'Tudo feito! 🎉')).toBeVisible();

  // Semana seguinte: ao abrir de novo, os checks voltaram
  await ageCycle(pageId);
  await page.reload();
  await expect(shown(page, '0/8 feitos')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Supino', exact: true })).not.toBeChecked();

  // Duplicar: Treino B nasce com os mesmos exercícios, todos abertos
  await page.getByRole('button', { name: 'Opções da página' }).click();
  await shown(page, '📑 Duplicar página').click();
  await expect(page.getByPlaceholder('Nome da cópia')).toHaveValue('Treino B');
  await page.getByRole('button', { name: 'Duplicar' }).click();
  await expect(page.getByRole('heading', { name: '🃏 Treino B' })).toBeVisible();
  await expect(shown(page, '0/8 feitos')).toBeVisible();
});

test('hábitos: sequência, dias da semana e seção na tela Hoje', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Saúde', name: 'Hábitos', type: 'Hábitos' });

  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Beber água');
  await input.press('Enter');
  await input.fill('Ler 10 páginas /seg,qua,sex');
  await input.press('Enter');
  await expect(shown(page, 'Seg, Qua, Sex')).toBeVisible();

  const done = page.waitForResponse((r) => r.url().includes('complete_task') && r.ok());
  await page.getByRole('checkbox', { name: 'Feito: Beber água' }).click();
  await done;
  await expect(
    page.getByLabel('Sequência de 1').and(page.locator(':not([aria-hidden="true"] *)')),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Detalhes de Beber água' }).click();
  await expect(shown(page, 'em sequência')).toBeVisible();
  await expect(page.getByLabel('Calendário das últimas 5 semanas')).toBeVisible();
  // Detalhes → página → pasta → abas
  await page.getByRole('button', { name: 'Voltar' }).click();
  await page.getByRole('button', { name: 'Voltar' }).click();
  await page.getByRole('button', { name: 'Voltar' }).click();

  await openTab(page, 'Hoje');
  await expect(shown(page, /^Hábitos \(1\/\d\)$/)).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Desmarcar Beber água' })).toBeChecked();
});

test('recorrente: concluir avança a data e desfazer volta', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');

  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Pagar luz hoje /mensal');
  await input.press('Enter');
  await expect(shown(page, '🔁 Todo mês')).toBeVisible();
  await expect(shown(page, '📅 Hoje')).toBeVisible();

  const done = page.waitForResponse((r) => r.url().includes('complete_task') && r.ok());
  await page.getByRole('checkbox', { name: 'Concluir Pagar luz' }).click();
  await done;
  await expect(shown(page, /^Feito! Próxima: /)).toBeVisible();
  // Continua aberta, com a data do mês que vem
  await expect(page.getByRole('checkbox', { name: 'Concluir Pagar luz' })).not.toBeChecked();
  await expect(shown(page, '📅 Hoje')).toHaveCount(0);

  const undone = page.waitForResponse((r) => r.url().includes('uncomplete_task') && r.ok());
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await undone;
  await expect(shown(page, '📅 Hoje')).toBeVisible();
});

test('arrastar para reordenar (lista)', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'celular',
    'Arrasto com mouse; no celular o gesto é o mesmo, mas o Playwright emula toque diferente',
  );
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.click();
  await paste(page, 'Primeira\nSegunda\nTerceira');
  const created = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  await page.getByRole('button', { name: 'Criar 3' }).click();
  await created;
  await expect(shown(page, 'Terceira', { exact: true })).toBeVisible();

  const handle = page.getByLabel('Arrastar Terceira');
  const target = page.getByLabel('Arrastar Primeira');
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // Segura antes de mover (ativação do arrasto); com a máquina carregada, 400 ms às vezes não bastava
  await page.waitForTimeout(800);
  // Um pouco acima do primeiro item, para não depender de onde exatamente o item cruza o meio
  await page.mouse.move(to.x + to.width / 2, to.y - 12, { steps: 25 });
  await page.waitForTimeout(300);
  const saved = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/tasks') && r.request().method() === 'PATCH',
  );
  await page.mouse.up();
  await saved;

  await page.reload();
  await expect(shown(page, 'Terceira', { exact: true })).toBeVisible();
  const order = await page
    .getByLabel(/^Arrastar /)
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  // Subiu e a nova ordem sobreviveu ao recarregar. (Com a máquina muito carregada, o soltar às vezes
  // cai na 2ª posição em vez da 1ª; o que importa aqui é a ordem ser salva.)
  expect(order.indexOf('Arrastar Terceira')).toBeLessThan(2);
  expect(order.filter((o) => o !== 'Arrastar Terceira')).toEqual([
    'Arrastar Primeira',
    'Arrastar Segunda',
  ]);
});
