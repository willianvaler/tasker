import { expect, test } from '@playwright/test';

import { ageTask, signUp } from './helpers';

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
