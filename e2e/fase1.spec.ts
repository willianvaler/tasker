import { expect, test } from '@playwright/test';

import { openTab, paste, signUp } from './helpers';

test('Hoje: criar com data, concluir com 1 toque e desfazer', async ({ page }, testInfo) => {
  await signUp(page, testInfo);

  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await expect(input).toHaveAttribute('placeholder', 'Nova tarefa para hoje…');
  await input.fill('Ligar pro banco !!');
  await input.press('Enter');
  await expect(input).toBeFocused();

  const row = page.getByText('Ligar pro banco', { exact: true });
  await expect(row).toBeVisible();
  await expect(page.getByText('!!', { exact: true })).toBeVisible();

  await page.getByRole('checkbox', { name: 'Concluir Ligar pro banco' }).click();
  await expect(page.getByText('Concluída: Ligar pro banco')).toBeVisible();
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByRole('checkbox', { name: 'Concluir Ligar pro banco' })).toBeVisible();

  // Concluída de vez: some da tela Hoje depois de recarregar
  const saved = page.waitForResponse((r) => r.url().includes('complete_task') && r.ok());
  await page.getByRole('checkbox', { name: 'Concluir Ligar pro banco' }).click();
  await saved;
  await page.reload();
  await expect(page.getByRole('heading', { name: /^Hoje/ })).toBeVisible();
  await expect(page.getByText('Nada para hoje.')).toBeVisible();
});

test('critério de aceite: colar 10 tarefas em menos de 10 segundos', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');

  const list = Array.from({ length: 10 }, (_, i) => `- Item ${i + 1}`).join('\n');
  const start = Date.now();

  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await expect(input).toHaveAttribute('placeholder', /Nova tarefa/);
  await input.click();
  await paste(page, list);
  await expect(page.getByText('10 tarefas serão criadas')).toBeVisible();
  const saved = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  await page.getByRole('button', { name: 'Criar 10' }).click();
  await expect(page.getByText('Item 10', { exact: true })).toBeVisible();

  expect(Date.now() - start).toBeLessThan(10_000);
  for (let i = 1; i <= 10; i++)
    await expect(page.getByText(`Item ${i}`, { exact: true })).toBeVisible();

  // Recarrega só depois do servidor confirmar (recarregar antes cancela o envio)
  await saved;
  await page.reload();
  await expect(page.getByText('Item 10', { exact: true })).toBeVisible();
});

test('lote: subtarefas, [x], remover item na prévia e sintaxe rápida', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  await page.getByRole('button', { name: 'Adicionar várias' }).click();

  await page
    .getByRole('textbox', { name: 'Lista de tarefas' })
    .fill('Treino\n  Supino\n  [x] Remada\nCarne #churrasco; Carvão\nErrado');
  await expect(page.getByText('6 tarefas serão criadas')).toBeVisible();
  await page.getByRole('button', { name: 'Tirar Errado' }).click();
  await expect(page.getByText('5 tarefas serão criadas')).toBeVisible();
  await page.getByRole('button', { name: 'Criar 5' }).click();

  await expect(page.getByText('Treino', { exact: true })).toBeVisible();
  await expect(page.getByText('☑ 1/2')).toBeVisible();
  await expect(page.getByText('#churrasco')).toBeVisible();
  await expect(page.getByText('Errado')).toHaveCount(0);
  // Subtarefas não aparecem soltas na lista
  await expect(page.getByText('Supino')).toHaveCount(0);
});

test('pastas e páginas, detalhes da tarefa', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Pastas');

  await page.getByRole('button', { name: '+ Nova pasta' }).click();
  await page.getByPlaceholder('Nome (ex.: Academia)').fill('Academia');
  await page.getByPlaceholder('Emoji (opcional, ex.: 🏋️)').fill('🏋️');
  await page.getByRole('button', { name: 'Salvar' }).click();
  // A pasta nova abre sozinha, vazia
  await expect(page.getByRole('heading', { name: '🏋️ Academia' })).toBeVisible();

  await page.getByRole('button', { name: '+ Criar a primeira página' }).click();
  await page.getByPlaceholder('Nome (ex.: Treino A)').fill('Treino A');
  await page.getByRole('button', { name: 'Salvar' }).click();
  // A página nova abre sozinha
  await expect(page.getByRole('heading', { name: '📄 Treino A' })).toBeVisible();

  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Agachamento !!! #perna amanhã');
  await input.press('Enter');
  await expect(page.getByText('Agachamento', { exact: true })).toBeVisible();
  await expect(page.getByText('📅 Amanhã')).toBeVisible();
  await expect(page.getByText('#perna')).toBeVisible();

  await page.getByRole('button', { name: 'Detalhes de Agachamento' }).click();
  const sub = page.getByRole('textbox', { name: 'Nova subtarefa' });
  await sub.fill('4x12 · 20kg');
  await sub.press('Enter');
  await expect(page.getByText('4x12 · 20kg')).toBeVisible();
  await page.getByRole('button', { name: 'Sem data' }).click();
  await page.getByRole('textbox', { name: 'Notas' }).fill('Descer até 90 graus');
  await page.getByRole('button', { name: 'Voltar' }).click();

  await expect(page.getByText('☑ 0/1')).toBeVisible();
  await expect(page.getByText('📅 Amanhã')).toHaveCount(0);

  // Renomear a página pelo menu (volta da página para a pasta)
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page.getByRole('heading', { name: '🏋️ Academia' })).toBeVisible();
  await page.getByRole('button', { name: 'Opções de 📄 Treino A' }).click();
  await page.getByText('⚙️ Configurar').click();
  await page.getByPlaceholder('Nome (ex.: Treino A)').fill('Treino B');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('link', { name: /📄 Treino B/ }).first()).toBeVisible();

  // A aba Pastas lista a pasta em card, com a página dentro (2 toques até ela)
  await page.getByRole('button', { name: 'Voltar' }).click();
  await openTab(page, 'Pastas');
  await expect(page.getByRole('link', { name: /🏋️ Academia/ }).first()).toBeVisible();
  await page.getByRole('link', { name: '📄 Treino B' }).first().click();
  await expect(page.getByRole('heading', { name: '📄 Treino B' })).toBeVisible();
});

test('barra lateral: criar pasta, ver a árvore e abrir a página', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Barra lateral é só em tela larga');
  await signUp(page, testInfo);
  const nav = page.getByRole('navigation');

  await nav.getByRole('button', { name: 'Nova pasta' }).click();
  await page.getByPlaceholder('Nome (ex.: Academia)').fill('Casa');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { name: '📁 Casa' })).toBeVisible();
  // A pasta aparece na barra lateral, já aberta (é a tela atual)
  await expect(nav.getByRole('link', { name: '📁 Casa' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Recolher 📁 Casa' })).toBeVisible();

  await nav.getByRole('button', { name: '+ Nova página' }).click();
  await page.getByPlaceholder('Nome (ex.: Treino A)').fill('Mercado');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { name: '📄 Mercado' })).toBeVisible();
  // Dentro da página a barra continua, com a página marcada
  await expect(nav.getByRole('link', { name: '📄 Mercado' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await nav.getByRole('button', { name: 'Recolher 📁 Casa' }).click();
  await expect(nav.getByRole('link', { name: '📄 Mercado' })).toHaveCount(0);
  await openTab(page, 'Hoje');
  await expect(page.getByRole('heading', { name: /^Hoje/ })).toBeVisible();
});

test('captura rápida com Ctrl+K vai para a última página usada', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Atalho de teclado é só na web com teclado');
  await signUp(page, testInfo);

  await page.keyboard.press('Control+k');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await expect(page.getByText('Captura rápida')).toBeVisible();
  await input.fill('Ideia solta');
  await input.press('Enter');
  await expect(page.getByText('Criada em 📥 Caixa de entrada')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Captura rápida')).toHaveCount(0);

  await openTab(page, 'Caixa de entrada');
  await expect(page.getByText('Ideia solta', { exact: true })).toBeVisible();
});

test('botão + abre a captura no celular', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'celular', 'O botão flutuante só aparece em tela estreita');
  await signUp(page, testInfo);
  await page.getByRole('button', { name: 'Captura rápida' }).click();
  await expect(page.getByText('Captura rápida', { exact: true })).toBeVisible();
});

test('sair limpa os dados da tela', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await page.getByRole('textbox', { name: 'Nova tarefa' }).fill('Segredo');
  await page.getByRole('textbox', { name: 'Nova tarefa' }).press('Enter');
  await expect(page.getByText('Segredo', { exact: true })).toBeVisible();

  await openTab(page, 'Perfil');
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  const cache = await page.evaluate(() => localStorage.getItem('questlist-cache'));
  expect(cache ?? '').not.toContain('Segredo');
});
