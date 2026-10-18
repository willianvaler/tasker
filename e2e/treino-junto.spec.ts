import { devices, expect, test, type Page } from '@playwright/test';

import { adminRest, signUp } from './helpers';

const userIdOf = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    return JSON.parse(localStorage.getItem(key ?? '') ?? '{}').user?.id as string;
  });

// V6 §15.4 (AC10.1, AC10.2): Ana escolhe a Bia, a Bia entra pelo aviso, as séries valem para o
// grupo e quem marca a última conclui.
test('treinar junto: convite, entrar, série do grupo e conclusão', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'duas pessoas: basta um perfil');
  test.setTimeout(120_000);
  await signUp(page, testInfo);
  const ana = await userIdOf(page);

  const biaContext = await browser.newContext({ ...devices['Desktop Chrome'] });
  const bia = await biaContext.newPage();
  await signUp(bia, testInfo);
  const biaId = await userIdOf(bia);

  // Projeto da Ana com a Bia, e um treino com 2 séries
  const stamp = Date.now();
  const [folder] = await adminRest('folders', {
    method: 'POST',
    body: JSON.stringify({
      owner_id: ana,
      name: `Dupla ${stamp}`,
      kind: 'project',
      is_shared: true,
    }),
  });
  await adminRest('folder_members', {
    method: 'POST',
    body: JSON.stringify({ folder_id: folder.id, user_id: biaId, role: 'editor' }),
  });
  const [workout] = await adminRest('pages', {
    method: 'POST',
    body: JSON.stringify({ folder_id: folder.id, name: `Treino ${stamp}`, view_type: 'cards' }),
  });
  const [task] = await adminRest('tasks', {
    method: 'POST',
    body: JSON.stringify({
      page_id: workout.id,
      title: 'Supino',
      created_by: ana,
      repeat_plan: { mode: 'sets', total: 2 },
      created_at: new Date(Date.now() - 3600_000).toISOString(),
    }),
  });

  await page.goto(`/treino/${workout.id}`);
  await expect(page.getByRole('heading', { name: 'Quem está treinando junto agora?' })).toBeVisible(
    {
      timeout: 20_000,
    },
  );
  await page.getByRole('checkbox', { name: 'Teste E2E' }).click();
  await page.getByRole('button', { name: 'Começar com 1 pessoa' }).click();
  await expect(page.getByText('Série 1 de 2')).toBeVisible();

  // A Bia recebe o aviso e entra
  await expect(bia.getByRole('alert').filter({ hasText: 'com você' })).toBeVisible({
    timeout: 20_000,
  });
  await bia.getByRole('button', { name: 'Entrar' }).click();
  await expect(bia.getByText('com Teste E2E')).toBeVisible({ timeout: 15_000 });

  // A Bia marca a primeira; a Ana vê a contagem do grupo e marca a última
  await bia.getByRole('button', { name: 'Feita' }).click();
  await expect(page.getByText('Série 2 de 2')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Feita' }).click();
  await expect
    .poll(async () => (await adminRest(`tasks?id=eq.${task.id}&select=status,completed_by`))[0], {
      timeout: 20_000,
    })
    .toEqual({ status: 'done', completed_by: ana });
  await biaContext.close();
});
