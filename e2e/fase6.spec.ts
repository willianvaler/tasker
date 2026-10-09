import { expect, test } from '@playwright/test';

import { ageTask, openTab, paste, shown, signUp } from './helpers';

test('kanban: A fazer → Fazendo → Feito, com XP ao concluir', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await page
    .getByRole('button', { name: 'Nova pasta' })
    .or(page.getByRole('tab', { name: 'Pastas' }))
    .first()
    .click();
  if (testInfo.project.name === 'celular')
    await page.getByRole('button', { name: '+ Nova pasta' }).click();
  await page.getByPlaceholder('Nome (ex.: Academia)').fill('Trabalho');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.getByRole('button', { name: '+ Criar a primeira página' }).click();
  await page.getByPlaceholder('Nome (ex.: Treino A)').fill('Quadro');
  await page.getByRole('radio', { name: /Kanban/ }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { name: '📋 Quadro' })).toBeVisible();

  const title = `Relatório ${Date.now()}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  const created = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  await input.fill(title);
  await input.press('Enter');
  await created;
  await ageTask(title);
  await expect(page.getByLabel('Coluna A fazer').getByText(title)).toBeVisible();

  await page.getByRole('button', { name: `Mover ${title} para Fazendo` }).click();
  await expect(page.getByLabel('Coluna Fazendo').getByText(title)).toBeVisible();

  const done = page.waitForResponse((r) => r.url().includes('set_task_status') && r.ok());
  await page.getByRole('button', { name: `Mover ${title} para Feito` }).click();
  await done;
  await expect(page.getByLabel('Coluna Feito').getByText(title)).toBeVisible();
  await expect(page.getByText(`Feito: ${title} · +10 XP`, { exact: false })).toBeVisible();

  // Volta: sai de Feito e o XP sai junto (o servidor confirma depois de recarregar)
  const back = page.waitForResponse((r) => r.url().includes('set_task_status') && r.ok());
  await page.getByRole('button', { name: `Mover ${title} para Fazendo` }).click();
  await back;
  await page.reload();
  await expect(page.getByLabel('Coluna Fazendo').getByText(title)).toBeVisible();
});

test('tema: Sistema segue o navegador; Claro e Escuro valem mesmo recarregando', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Igual nos dois perfis');
  await page.emulateMedia({ colorScheme: 'dark' });
  await signUp(page, testInfo);
  const html = page.locator('html');
  // Sistema (padrão) com o navegador escuro
  await expect(html).toHaveClass(/dark/);

  await page
    .getByRole('navigation')
    .getByRole('link', { name: /Perfil/ })
    .click();
  await page.getByRole('radio', { name: '☀️ Claro' }).click();
  await expect(html).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.getByRole('radio', { name: '☀️ Claro' })).toBeVisible();
  await expect(html).not.toHaveClass(/dark/);

  await page.getByRole('radio', { name: 'Sistema' }).click();
  await expect(html).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(html).not.toHaveClass(/dark/);

  await page.getByRole('radio', { name: '🌙 Escuro' }).click();
  await expect(html).toHaveClass(/dark/);
  const background = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--background').trim(),
  );
  expect(background).toBe('2 6 23');
});

test('onboarding em 3 passos: captura, pasta inicial e gamificação', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByText('Não tenho conta').click();
  await page.getByPlaceholder('Seu nome').fill('Nova Pessoa');
  await page
    .getByPlaceholder('E-mail')
    .fill(`e2e-onb-${testInfo.project.name}-${Date.now()}@teste.local`);
  await page.getByPlaceholder('Senha').fill('senha-forte-123');
  await page.getByRole('button', { name: 'Criar conta' }).click();

  // 1. Capturar
  await expect(page.getByRole('heading', { name: 'Anote em 2 segundos' })).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Comprar pão amanhã !!');
  await input.press('Enter');
  await expect(page.getByText('✓ Tarefa criada na Caixa de entrada.')).toBeVisible();
  await page.getByRole('button', { name: 'Próximo' }).click();

  // 2. Organizar: cria a pasta de treino pronta
  await expect(page.getByRole('heading', { name: 'Organize em pastas' })).toBeVisible();
  await page.getByRole('button', { name: 'Criar pasta Academia' }).click();
  await expect(page.getByText('🏋️ Academia ✓')).toBeVisible();
  await page.getByRole('button', { name: 'Próximo' }).click();

  // 3. Gamificação
  await expect(page.getByRole('heading', { name: 'Ganhe XP fazendo' })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Gamificação' })).toBeChecked();
  const saved = page.waitForResponse(
    (r) => r.url().includes('/profiles') && r.request().method() === 'PATCH' && r.ok(),
  );
  await page.getByRole('button', { name: 'Começar' }).click();
  await saved;

  await expect(page.getByRole('heading', { name: /^Hoje/ })).toBeVisible();
  await openTab(page, 'Pastas');
  await expect(page.getByRole('link', { name: /🏋️ Academia/ }).first()).toBeVisible();
  // Vista uma vez, não volta
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Pastas' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pular introdução' })).toHaveCount(0);
});

test('acessibilidade: reordenar pelo teclado, sem arrastar', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Teclado físico só no desktop');
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.click();
  await paste(page, 'Primeira\nSegunda\nTerceira');
  const created = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  await page.getByRole('button', { name: 'Criar 3' }).click();
  await created;

  const titles = () => shown(page, /^(Primeira|Segunda|Terceira)$/).allTextContents();
  await expect.poll(titles).toEqual(['Primeira', 'Segunda', 'Terceira']);

  await page.getByRole('button', { name: 'Arrastar Terceira' }).focus();
  const saved = page.waitForResponse(
    (r) => r.url().includes('/tasks') && r.request().method() === 'PATCH' && r.ok(),
  );
  await page.keyboard.press('ArrowUp');
  await saved;
  await expect.poll(titles).toEqual(['Primeira', 'Terceira', 'Segunda']);
  await page.reload();
  await expect.poll(titles).toEqual(['Primeira', 'Terceira', 'Segunda']);
});

test('performance: lista com 500 tarefas, marcar responde rápido', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Mede uma vez, no desktop');
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  await page.getByRole('textbox', { name: 'Nova tarefa' }).click();
  await paste(page, Array.from({ length: 500 }, (_, i) => `Item ${i + 1}`).join('\n'));
  const created = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  await page.getByRole('button', { name: 'Criar 500' }).click();
  await created;
  await page.reload();
  await expect(page.getByText('Item 500', { exact: true })).toBeAttached({ timeout: 30_000 });

  // Medido dentro da página: do clique até a tarefa sair da lista (o Playwright em si é lento
  // para consultar 500 linhas). Meta do ESCOPO 9: < 100 ms; aqui com folga para máquina lenta.
  const ms = await page.evaluate(async () => {
    const label = 'Concluir Item 10';
    const box = document.querySelector<HTMLElement>(`[aria-label="${label}"]`);
    if (!box) throw new Error('sem a tarefa');
    const t0 = performance.now();
    box.click();
    await new Promise<void>((resolve) => {
      const check = () =>
        document.querySelector(`[aria-label="${label}"]`)
          ? requestAnimationFrame(check)
          : resolve();
      check();
    });
    return performance.now() - t0;
  });
  expect(ms).toBeLessThan(150);
});
