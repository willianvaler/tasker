import { expect, test } from '@playwright/test';

import { signUp } from './helpers';

// R1.1 e R1.2 (reforma de usabilidade 2, D371): o editor de blocos na web. O "/" abre o menu com os
// componentes; o que se escreve é gravado no mesmo Markdown, que o modo Markdown mostra.
test('editor de blocos: menu /, título, lista de tarefas, tabela, callout e consulta', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'o editor de blocos do celular é o R1.4');
  await signUp(page, testInfo);
  await page.evaluate(() => localStorage.setItem('questlist:note-editor', 'blocks'));
  await page.getByRole('button', { name: 'Nova anotação' }).first().click();
  await page.getByRole('textbox', { name: 'Título da anotação' }).fill('Blocos');
  const editor = page.getByTestId('block-editor').locator('.ql-editor');
  await editor.click();

  // "/tit" e Enter: Título 1 (o primeiro que bate)
  await page.keyboard.type('/título 2');
  await expect(page.getByRole('option', { name: /Título 2/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Plano da semana');
  await page.keyboard.press('Enter');
  // Atalho de Markdown ao digitar: "[ ] " vira tarefa
  await page.keyboard.type('/tarefas');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Comprar tinta');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/callout');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Atenção ao prazo');
  await expect(editor.locator('h2')).toHaveText('Plano da semana');
  await expect(editor.locator('ul[data-type="taskList"] li')).toHaveCount(1);
  await expect(editor.locator('.ql-callout')).toContainText('Atenção ao prazo');

  // Sai do callout e põe uma consulta e uma tabela
  await editor.locator('h2').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/consulta');
  await page.keyboard.press('Enter');
  await expect(editor.locator('[data-raw="consulta"]')).toBeVisible();

  // O + ao lado do bloco (passando o mouse) abre o mesmo menu numa linha nova
  await editor.locator('h2').hover();
  await page.getByRole('button', { name: 'Acrescentar um bloco' }).click();
  await expect(page.getByRole('option', { name: /Tabela/ })).toBeVisible();
  await page.keyboard.type('tabela');
  await page.keyboard.press('Enter');
  await expect(editor.locator('table tr')).toHaveCount(3);
  await page.keyboard.type('Cor');

  // O modo Markdown mostra o texto gravado
  await page.getByRole('button', { name: 'Editar como Markdown' }).click();
  const md = page.getByRole('textbox', { name: 'Texto da anotação' });
  await expect(md).toHaveValue(/^## Plano da semana\n/);
  await expect(md).toHaveValue(/```questlist\ntarefas onde vence <= hoje\+7 não concluídas\n```/);
  await expect(md).toHaveValue(/- \[ \] Comprar tinta/);
  await expect(md).toHaveValue(/> \[!tip\]\n> Atenção ao prazo/);
  await expect(md).toHaveValue(/\| Cor \|  \|  \|\n\| --- \| --- \| --- \|/);

  // Volta para os blocos e recarrega: o texto ficou salvo
  await page.getByRole('button', { name: 'Voltar ao editor de blocos' }).click();
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByRole('button', { name: 'Editar' }).click();
  await expect(editor.locator('h2')).toHaveText('Plano da semana');
  await expect(editor.locator('.ql-callout')).toContainText('Atenção ao prazo');
});

// R1.3 (D372): [[ com sugestões e a prévia da fórmula, dentro do editor de blocos
test('editor de blocos: [[ sugere anotações e a fórmula aparece desenhada', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'o editor de blocos do celular é o R1.4');
  // O MathJax é carregado na primeira fórmula
  test.setTimeout(120_000);
  await signUp(page, testInfo);
  await page.evaluate(() => localStorage.setItem('questlist:note-editor', 'blocks'));
  // Uma anotação para ser citada
  await page.getByRole('button', { name: 'Nova anotação' }).first().click();
  await page.getByRole('textbox', { name: 'Título da anotação' }).fill('Receita de bolo');
  const editor = page.getByTestId('block-editor').locator('.ql-editor');
  await editor.click();
  await page.keyboard.type('Farinha e ovos');
  await page.waitForTimeout(1200);

  const first = page.url();
  await page.getByRole('button', { name: 'Nova anotação' }).first().click();
  await expect.poll(() => page.url()).not.toBe(first);
  // A anotação anterior fica montada embaixo: vale o último editor
  const second = page.getByTestId('block-editor').last().locator('.ql-editor');
  await page.getByRole('textbox', { name: 'Título da anotação' }).last().fill('Cardápio');
  await second.click();
  await page.keyboard.type('Sobremesa: [[Rece');
  await expect(page.getByRole('option', { name: /Receita de bolo/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(second.locator('[data-raw-inline="link"]')).toHaveText('Receita de bolo');

  await page.keyboard.press('Enter');
  await page.keyboard.type('/fórmula');
  await page.keyboard.press('Enter');
  await page.keyboard.type('x^2');
  await expect(second.locator('.ql-math-preview svg')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Editar como Markdown' }).last().click();
  const md = page.getByRole('textbox', { name: 'Texto da anotação' }).last();
  await expect(md).toHaveValue(/^Sobremesa: \[\[Receita de bolo\|n:[0-9a-f-]{36}\]\] *\n\n\$\$\nx\^2\n\$\$/);
});
