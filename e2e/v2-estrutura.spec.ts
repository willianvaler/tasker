import { expect, test } from '@playwright/test';

import { createPage, signUp } from './helpers';

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
