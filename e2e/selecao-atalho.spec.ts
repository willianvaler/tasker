import { expect, test, type Page } from '@playwright/test';

import { adminRest, openTab, signUp } from './helpers';

const userIdOf = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    return JSON.parse(localStorage.getItem(key ?? '') ?? '{}').user?.id as string;
  });

// Pedido do dono (25/11): selecionar uma tarefa dentro de uma anotação e fechar a anotação deixava
// a seleção valendo, e o atalho D abria a data dela na tela de baixo.
test('seleção feita na anotação não vaza para os atalhos da lista', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Teclado: desktop');
  await signUp(page, testInfo);
  const stamp = Date.now();
  const title = `Pagar luz ${stamp}`;
  await openTab(page, 'Caixa de entrada');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(title);
  await input.press('Enter');
  await expect(page.getByRole('checkbox', { name: `Concluir ${title}` })).toBeVisible();
  await input.press('Escape');

  const uid = await userIdOf(page);
  const [note] = await adminRest('notes', {
    method: 'POST',
    body: JSON.stringify({
      user_id: uid,
      title: `Consulta ${stamp}`,
      body: '```questlist\ntarefas da lista "Caixa de entrada" não concluídas\n```\n',
    }),
  });
  await page.goto(`/nota/${note.id}`);
  const box = await page
    .getByRole('checkbox', { name: `Concluir ${title}` })
    .last()
    .boundingBox();
  if (!box) throw new Error('a tarefa não apareceu na consulta');
  // Clique na linha, fora do título: seleciona
  await page.mouse.click(box.x + 4, box.y + box.height + 2);
  await page.mouse.click(box.x + box.width + 500, box.y + box.height / 2);
  // Na própria anotação, fora do editor: o D não abre a data da tarefa da tela de baixo
  await page.keyboard.press('d');
  await expect(page.getByText(`Data de "${title}"`)).toHaveCount(0);

  await openTab(page, 'Caixa de entrada');
  await expect(page.getByRole('checkbox', { name: `Concluir ${title}` })).toBeVisible();
  await page.keyboard.press('d');
  await expect(page.getByText(`Data de "${title}"`)).toHaveCount(0);

  // A seleção da própria lista continua funcionando (o foco sai do campo, como na lista de sempre)
  await page.getByRole('textbox', { name: 'Nova tarefa' }).click();
  await page.getByRole('textbox', { name: 'Nova tarefa' }).press('Escape');
  await page.keyboard.press('j');
  await page.keyboard.press('d');
  await expect(page.getByText(`Data de "${title}"`)).toBeVisible();
});
