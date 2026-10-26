import { devices, expect, test, type Page } from '@playwright/test';

import { adminRest, signUp } from './helpers';

const userIdOf = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    return JSON.parse(localStorage.getItem(key ?? '') ?? '{}').user?.id as string;
  });

// AC15B: Ana põe um treino da Academia dela num grupo de treino; a Bia, do grupo, vê o treino no
// grupo com o nome da Ana e o abre. Desmarcado o grupo, a Bia deixa de ver.
test('treino da Academia num grupo de treino', async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'duas pessoas: basta um perfil');
  test.setTimeout(120_000);
  await signUp(page, testInfo);
  const ana = await userIdOf(page);

  const biaContext = await browser.newContext({ ...devices['Desktop Chrome'] });
  const bia = await biaContext.newPage();
  await signUp(bia, testInfo);
  const biaId = await userIdOf(bia);

  const stamp = Date.now();
  let [gym] = await adminRest(`folders?owner_id=eq.${ana}&is_gym=eq.true&select=id`);
  if (!gym) {
    [gym] = await adminRest('folders', {
      method: 'POST',
      body: JSON.stringify({ owner_id: ana, name: 'Academia', is_gym: true }),
    });
  }
  const [group] = await adminRest('folders', {
    method: 'POST',
    body: JSON.stringify({
      owner_id: ana,
      name: `Grupo ${stamp}`,
      kind: 'project',
      gym_group: true,
      is_shared: true,
    }),
  });
  await adminRest('folder_members', {
    method: 'POST',
    body: JSON.stringify({ folder_id: group.id, user_id: biaId, role: 'editor' }),
  });
  const name = `Treino ${stamp}`;
  const [workout] = await adminRest('pages', {
    method: 'POST',
    body: JSON.stringify({ folder_id: gym.id, name, view_type: 'cards' }),
  });
  await adminRest('tasks', {
    method: 'POST',
    body: JSON.stringify({ page_id: workout.id, title: 'Remada', created_by: ana }),
  });

  await page.goto(`/page/${workout.id}`);
  await page.getByRole('button', { name: 'Compartilhar' }).first().click();
  await page.getByRole('menuitem', { name: 'Adicionar a um grupo' }).click();
  await page.getByRole('checkbox', { name: `Grupo ${stamp}` }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Treino em 1 grupo')).toBeVisible();

  await bia.goto(`/folder/${group.id}`);
  // A linha do grupo leva o nome de quem pôs (a barra lateral também mostra o recebido)
  const row = bia.getByRole('link', { name: `${name} de Teste E2E` });
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.click();
  await expect(bia.getByText('Remada').first()).toBeVisible({ timeout: 20_000 });

  // Ana tira do grupo: a Bia perde o envio
  await page.getByRole('button', { name: 'Compartilhar' }).first().click();
  await page.getByRole('menuitem', { name: 'Adicionar a um grupo' }).click();
  await page.getByRole('checkbox', { name: `Grupo ${stamp}` }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect
    .poll(
      async () =>
        (await adminRest(`page_shares?page_id=eq.${workout.id}&status=eq.active&select=id`)).length,
      { timeout: 20_000 },
    )
    .toBe(0);
  await biaContext.close();
});
