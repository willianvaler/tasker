import { expect, test } from '@playwright/test';

import { openTab, signUp } from './helpers';

// OB7 (ESCOPO_V11 §5, D292): o bloco ```questlist na anotação, com a lista de tarefas marcável, a
// contagem, a tabela, a consulta de anotações, o aviso sem filtro e o erro de escrita.
test('anotações: consulta questlist', async ({ page }, testInfo) => {
  const desktop = testInfo.project.name === 'desktop';
  const stamp = `${testInfo.project.name}${Date.now()}`;
  const tag = `casa${stamp}`;
  await signUp(page, testInfo);

  await openTab(page, 'Caixa de entrada');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  for (const title of [`Lavar ${stamp} #${tag}`, `Pintar ${stamp} #${tag}`, `Ler ${stamp}`]) {
    await input.fill(title);
    await input.press('Enter');
  }
  await expect(page.getByRole('checkbox', { name: `Concluir Ler ${stamp}` })).toBeVisible();

  if (desktop) await page.getByRole('button', { name: 'Nova anotação' }).first().click();
  else {
    await page.getByRole('button', { name: 'Novo', exact: true }).last().click();
    await page.getByRole('menuitem', { name: 'Anotação' }).click();
  }
  await page.getByRole('textbox', { name: 'Título da anotação' }).fill(`Painel ${stamp}`);
  const body = page.getByRole('textbox', { name: 'Texto da anotação' });
  // O comando de barra põe a cerca com um exemplo
  await body.click();
  await body.pressSequentially('/consul');
  await body.press('Enter');
  await expect(body).toHaveValue(/^```questlist\ntarefas onde etiqueta = casa/);
  await body.fill(
    [
      `Painel da casa #${tag}`,
      '```questlist',
      `tarefas onde etiqueta = ${tag} não concluídas ordenar por título`,
      '```',
      '```questlist',
      `tarefas onde etiqueta = ${tag} não concluídas como contagem`,
      '```',
      '```questlist',
      `tasks where tag = ${tag} as table`,
      '```',
      '```questlist',
      `anotações onde etiqueta = ${tag}`,
      '```',
      '```questlist',
      'tarefas não concluídas',
      '```',
      '```questlist',
      'tarefas onde cor = azul',
      '```',
    ].join('\n'),
  );
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Visualizar' }).click();

  const blocks = page.getByTestId('note-query');
  await expect(blocks).toHaveCount(6);
  // Lista: as duas com a etiqueta, na ordem do título, com a caixinha de verdade
  const list = blocks.nth(0);
  await expect(list.getByRole('checkbox')).toHaveCount(2);
  await expect(list.getByRole('checkbox').first()).toHaveAccessibleName(`Concluir Lavar ${stamp}`);
  await expect(blocks.nth(1).getByTestId('query-count')).toHaveText('2 tarefas');
  await expect(blocks.nth(2).getByRole('table')).toContainText(`Pintar ${stamp}`);
  await expect(blocks.nth(2).getByRole('table')).toContainText(`#${tag}`);
  await expect(blocks.nth(3).getByRole('link', { name: `Painel ${stamp}` })).toBeVisible();
  await expect(blocks.nth(4)).toContainText('Consulta sem filtro');
  await expect(blocks.nth(5)).toContainText('Campo desconhecido: “cor”');

  // Concluir pela consulta: sai da lista das abertas e a contagem cai
  await list.getByRole('checkbox', { name: `Concluir Lavar ${stamp}` }).click();
  await page.waitForResponse((r) => r.url().includes('/rpc/complete_task'));
  await expect(list.getByRole('checkbox')).toHaveCount(1);
  await expect(blocks.nth(1).getByTestId('query-count')).toHaveText('1 tarefa');
  await expect(blocks.nth(2).getByRole('table')).toContainText(`☑ Lavar ${stamp}`);
});
