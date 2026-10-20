import { expect, test } from '@playwright/test';

import { adminRest, createPage, signUp } from './helpers';

test('lista de compras: ingredientes das notas viram uma lista nova, somando os iguais', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await signUp(page, testInfo);
  const pageId = await createPage(page, { folder: 'Cozinha', name: 'Cardápio', type: 'Lista' });
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  for (const dish of ['Lasanha', 'Omelete']) {
    await input.fill(dish);
    await input.press('Enter');
  }
  await expect
    .poll(async () => (await adminRest(`tasks?page_id=eq.${pageId}&select=id`)).length, {
      timeout: 20_000,
    })
    .toBe(2);
  const notes = {
    Lasanha: 'Forno 40 min.\n- 500 g de carne moída\n- 2 ovos',
    Omelete: '- 4 ovos\n- sal',
  };
  for (const [title, body] of Object.entries(notes))
    await adminRest(`tasks?page_id=eq.${pageId}&title=eq.${title}`, {
      method: 'PATCH',
      body: JSON.stringify({ notes: body }),
    });
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Concluir Omelete' })).toBeVisible();

  await page.getByRole('button', { name: 'Opções da página' }).click();
  await page.getByRole('menuitem', { name: 'Gerar lista de compras' }).click();
  await page.getByRole('menuitem', { name: 'Nova lista "Compras"' }).click();

  await expect(page.getByText('3 tarefas serão criadas')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Carne moída (500 g)', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Ovos (6)', { exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Criar 3' }).click();
  await expect
    .poll(
      async () =>
        (
          await adminRest(
            `tasks?title=in.("Carne moída (500 g)","Ovos (6)","Sal")&select=page:pages(name,folder_id)`,
          )
        ).filter((t: { page: { name: string } }) => t.page.name === 'Compras').length,
      { timeout: 20_000 },
    )
    .toBeGreaterThanOrEqual(3);
});
