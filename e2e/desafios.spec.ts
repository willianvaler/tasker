import { devices, expect, test, type Page } from '@playwright/test';

import { adminRest, signUp } from './helpers';

const userIdOf = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    return JSON.parse(localStorage.getItem(key ?? '') ?? '{}').user?.id as string;
  });

// V6 §15.5 (AC10.4, AC10.5): desafio do projeto com ranking de dias de treino, check-in no mural
// com reação e chat do grupo, entre duas pessoas.
test('treino em grupo: desafio, ranking, mural e chat', async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'duas pessoas: basta um perfil');
  test.setTimeout(120_000);
  await signUp(page, testInfo);
  const ana = await userIdOf(page);
  const biaContext = await browser.newContext({ ...devices['Desktop Chrome'] });
  const bia = await biaContext.newPage();
  await signUp(bia, testInfo);
  const biaId = await userIdOf(bia);

  const stamp = Date.now();
  const [folder] = await adminRest('folders', {
    method: 'POST',
    body: JSON.stringify({
      owner_id: ana,
      name: `Turma ${stamp}`,
      kind: 'project',
      // O treino conta só na Academia e nos grupos de treino (CD15)
      gym_group: true,
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
    body: JSON.stringify({ page_id: workout.id, title: 'Agachamento', created_by: ana }),
  });

  // A Ana entra pelo projeto e inicia o desafio
  await page.goto(`/folder/${folder.id}`);
  await page.getByRole('button', { name: 'Treino em grupo' }).click();
  await page.getByRole('button', { name: 'Iniciar novo desafio' }).click();
  await page.getByPlaceholder('Nome do desafio').fill(`Outubro ${stamp}`);
  await page.getByPlaceholder('Quantos dias dura (1 a 365)').fill('7');
  await page.getByRole('button', { name: 'Começar' }).click();
  await expect(page.getByRole('heading', { name: `Outubro ${stamp}` })).toBeVisible();
  await expect(page.getByText('dia 1 de 7').first()).toBeVisible();

  // Página de treino toda feita conta o dia da Ana no ranking
  await adminRest(`tasks?id=eq.${task.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'done',
      completed_by: ana,
      completed_at: new Date().toISOString(),
    }),
  });
  await page.reload();
  await expect(page.getByRole('list', { name: 'Ranking' })).toContainText(
    /^1.*Teste E2E1 dia2.*0 dias$/,
    {
      timeout: 15_000,
    },
  );

  // A Bia faz check-in no mural; a Ana vê e reage
  await bia.goto(`/grupo/projeto/${folder.id}`);
  await expect(bia.getByRole('heading', { name: `Outubro ${stamp}` })).toBeVisible();
  await bia.getByRole('tab', { name: 'Mural' }).click();
  await bia.getByRole('textbox', { name: 'Como foi o treino?' }).fill('Perna feita');
  await bia.getByRole('button', { name: 'Fazer check-in' }).click();
  await expect(bia.getByText('Perna feita')).toBeVisible();

  await page.getByRole('tab', { name: 'Mural' }).click();
  await expect(page.getByText('Perna feita')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: '💪, nenhuma reação' }).click();
  await expect(page.getByRole('button', { name: '💪, 1 reação' })).toBeVisible();

  // Chat
  await page.getByRole('tab', { name: 'Chat' }).click();
  await page.getByRole('textbox', { name: 'Mensagem para o grupo' }).fill('Amanhã às 7?');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await bia.getByRole('tab', { name: 'Chat' }).click();
  await expect(bia.getByText('Amanhã às 7?')).toBeVisible({ timeout: 15_000 });
  await biaContext.close();
});

// AC11 (D251): desafio terminado fecha no servidor e o pódio leva o prêmio (conquista, título e
// aviso); o ranking mostra as medalhas
test('desafio terminado: pódio, medalhas e aviso do prêmio', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'duas pessoas: basta um perfil');
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  const ana = await userIdOf(page);
  const biaContext = await browser.newContext({ ...devices['Desktop Chrome'] });
  const bia = await biaContext.newPage();
  await signUp(bia, testInfo);
  const biaId = await userIdOf(bia);
  await biaContext.close();

  const stamp = Date.now();
  const [folder] = await adminRest('folders', {
    method: 'POST',
    body: JSON.stringify({
      owner_id: ana,
      name: `Turma ${stamp}`,
      kind: 'project',
      gym_group: true,
      is_shared: true,
    }),
  });
  await adminRest('folder_members', {
    method: 'POST',
    body: JSON.stringify({ folder_id: folder.id, user_id: biaId, role: 'editor' }),
  });
  // Sete dias que acabaram há três: a Ana treinou em dois, a Bia em um
  const day = (ago: number) => new Date(Date.now() - ago * 86_400_000).toISOString().slice(0, 10);
  const [challenge] = await adminRest('challenges', {
    method: 'POST',
    body: JSON.stringify({
      folder_id: folder.id,
      name: `Setembro ${stamp}`,
      starts_on: day(10),
      days: 7,
      created_by: ana,
    }),
  });
  await adminRest('workout_days', {
    method: 'POST',
    body: JSON.stringify([
      { user_id: ana, day: day(9), source: 'page' },
      { user_id: ana, day: day(8), source: 'page' },
      { user_id: biaId, day: day(8), source: 'page' },
    ]),
  });
  // O pg_cron chama de hora em hora; aqui, na hora
  await adminRest('rpc/finish_challenges', { method: 'POST', body: '{}' });

  await page.goto('/notifications');
  await expect(
    page.getByText(`O desafio "Setembro ${stamp}" terminou: você ficou em 1º lugar 🥇`),
  ).toBeVisible({ timeout: 20_000 });
  await page.goto(`/desafio/${challenge.id}`);
  await expect(page.getByLabel('1º lugar: prêmio do desafio')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel('2º lugar: prêmio do desafio')).toBeVisible();
});
