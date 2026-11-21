import { expect, test } from '@playwright/test';

import { createPage, signUp, waitForSync } from './helpers';

// Visões salvas da lista (VS1, D317): a mesma lista como quadro por prioridade, tabela com edição
// na célula e calendário, cada visão numa aba que volta depois de recarregar.

test('visões salvas: quadro por prioridade, tabela e calendário da mesma lista', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Casa', name: 'Obra', type: 'Lista' });
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  for (const line of ['Comprar tinta !!! hoje', 'Pintar parede !', 'Chamar pedreiro']) {
    await input.fill(line);
    await input.press('Enter');
  }
  await expect(page.getByRole('checkbox', { name: 'Concluir Chamar pedreiro' })).toBeVisible();

  // Quadro por prioridade: mover o card muda a prioridade da tarefa
  await page.getByRole('button', { name: 'Nova visão' }).click();
  await page.getByRole('textbox', { name: 'Nome da visão' }).fill('Por prioridade');
  await page.getByRole('radio', { name: 'Quadro' }).click();
  await page
    .getByRole('radiogroup', { name: 'Agrupar por' })
    .getByRole('radio', { name: 'Prioridade' })
    .click();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Por prioridade' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const column = (title: string) => page.getByLabel(`Coluna ${title}`, { exact: true });
  await expect(column('!!!').getByText('Comprar tinta')).toBeVisible();
  await expect(column('Sem prioridade').getByText('Chamar pedreiro')).toBeVisible();
  await page.getByRole('button', { name: 'Mover Chamar pedreiro para !' }).click();
  await expect(column('!').getByText('Chamar pedreiro')).toBeVisible();
  await expect(column('Sem prioridade').getByText('Chamar pedreiro')).toHaveCount(0);

  // Tabela: editar o título na célula
  await page.getByRole('button', { name: 'Nova visão' }).click();
  await page.getByRole('textbox', { name: 'Nome da visão' }).fill('Planilha');
  await page.getByRole('radio', { name: 'Tabela' }).click();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByRole('cell', { name: 'Título: Pintar parede' }).click();
  const cell = page.getByRole('textbox', { name: 'Título: Pintar parede' });
  await cell.fill('Pintar a parede');
  await cell.press('Enter');
  await expect(page.getByRole('cell', { name: 'Título: Pintar a parede' })).toBeVisible();
  await waitForSync(page);

  // A visão é da lista (fica depois de recarregar) e a aba aberta é lembrada
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Planilha' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tab', { name: 'Por prioridade' })).toBeVisible();

  // Calendário: só as abertas; a de hoje no dia, as outras em "Sem data"
  await page.getByRole('button', { name: 'Nova visão' }).click();
  await page.getByRole('textbox', { name: 'Nome da visão' }).fill('Entregas');
  await page.getByRole('radio', { name: 'Calendário' }).click();
  await page.getByRole('radio', { name: 'Abertas' }).click();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Concluir Comprar tinta' })).toBeVisible();
  await expect(page.getByText('Sem data', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Concluir Pintar a parede' })).toBeVisible();

  // Apagar a visão volta para a lista
  await page.getByRole('button', { name: 'Mudar a visão Entregas' }).click();
  await page.getByRole('button', { name: 'Apagar a visão' }).click();
  await expect(page.getByRole('tab', { name: 'Entregas' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Lista' })).toHaveAttribute('aria-selected', 'true');
});
