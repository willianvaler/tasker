import { devices, expect, test } from '@playwright/test';

import { adminRest, createPage, signUp } from './helpers';

test('comunidade: publicar uma página, outra pessoa acha, curte e usa (a cópia vem com as notas)', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'celular',
    'O teste abre o segundo navegador por conta própria',
  );
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  const stamp = Date.now().toString(36);
  const pageId = await createPage(page, { folder: 'Cozinha', name: 'Cardápio', type: 'Lista' });
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Lasanha');
  await input.press('Enter');
  await expect
    .poll(async () => (await adminRest(`tasks?page_id=eq.${pageId}&select=id`)).length, {
      timeout: 20_000,
    })
    .toBe(1);
  await adminRest(`tasks?page_id=eq.${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ notes: '- 500 g de carne' }),
  });

  await page.getByRole('button', { name: 'Opções da página' }).click();
  await page.getByRole('menuitem', { name: 'Publicar na comunidade' }).click();
  await page.getByRole('textbox', { name: 'Título' }).fill(`Cardápio ${stamp}`);
  await page.getByRole('radio', { name: 'Cardápio' }).click();
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByRole('heading', { name: `Cardápio ${stamp}` })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Despublicar' })).toBeVisible();

  // Outra conta acha pela busca, curte e usa
  const context = await browser.newContext({ ...devices['Desktop Chrome'] });
  const bia = await context.newPage();
  await signUp(bia, testInfo);
  await bia.goto('/comunidade');
  await bia.getByRole('textbox', { name: 'Buscar na comunidade' }).fill(stamp);
  await bia.getByRole('button', { name: `Abrir Cardápio ${stamp}` }).click();
  await expect(bia.getByText('☐ Lasanha')).toBeVisible();
  await bia.getByRole('button', { name: 'Curtir (0)' }).click();
  await expect(bia.getByRole('button', { name: 'Curtido (1)' })).toBeVisible();
  await bia.getByRole('button', { name: 'Usar', exact: true }).click();
  await expect(bia.getByRole('heading', { name: `Cardápio ${stamp}` })).toBeVisible({
    timeout: 15_000,
  });
  await expect
    .poll(
      async () =>
        (
          await adminRest(
            `tasks?title=eq.Lasanha&notes=eq.${encodeURIComponent('- 500 g de carne')}&select=id`,
          )
        ).length,
      { timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(2);
  await context.close();
});
