import { expect, test } from '@playwright/test';

import { adminRest, openTab, shown, signUp } from './helpers';

// D186: no exercício, séries, repetições, carga e descanso (o descanso vai para o plano do Modo
// Treino), sem pomodoro nem cronômetro; e o grupo de treino no bloco Academia, que abre o convite.
test('academia: descanso no exercício e grupo de treino', async ({ page }, testInfo) => {
  const desktop = testInfo.project.name === 'desktop';
  await signUp(page, testInfo);
  await openTab(page, 'Início');
  const answer = page.waitForResponse((r) => r.url().includes('/rpc/set_gym_mode'));
  await page.getByRole('button', { name: 'Sim, vou treinar' }).click();
  await answer;

  const block = desktop ? page.getByRole('navigation') : page;
  if (!desktop) await openTab(page, 'Pastas');
  await block.getByRole('button', { name: 'Novo treino' }).first().click();
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  await page.getByPlaceholder('Nome do treino (ex.: Treino A)').fill(`Peito ${stamp}`);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { name: `Peito ${stamp}` })).toBeVisible();

  const title = `Supino ${stamp}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(title);
  await input.press('Enter');
  await page.getByRole('button', { name: `Detalhes de ${title}` }).click();

  await page.getByRole('textbox', { name: 'Séries', exact: true }).fill('3');
  await page.getByRole('textbox', { name: 'Repetições', exact: true }).fill('10');
  await page.getByRole('textbox', { name: 'Descanso', exact: true }).fill('90');
  await page.getByRole('textbox', { name: 'Carga', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Descanso', exact: true })).toHaveValue('1:30');
  await expect
    .poll(
      async () =>
        (await adminRest(`tasks?title=eq.${encodeURIComponent(title)}&select=repeat_plan,meta`))[0],
      { timeout: 20_000 },
    )
    .toEqual({
      repeat_plan: { mode: 'sets', total: 3, rest_seconds: 90 },
      meta: { sets: 3, reps: 10 },
    });
  await expect(page.getByRole('button', { name: 'Iniciar pomodoro' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Iniciar cronômetro' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // Grupo de treino: nasce compartilhável e abre o convite
  if (!desktop) {
    await page.getByRole('button', { name: 'Voltar' }).first().click();
    await openTab(page, 'Pastas');
  }
  await block.getByRole('button', { name: 'Novo grupo de treino' }).first().click();
  const group = `Treino com a Bia ${stamp}`;
  await page.getByPlaceholder('Nome (ex.: Treino com a Ana)').fill(group);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(shown(page, 'Compartilhar').first()).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(
      async () =>
        (await adminRest(`folders?name=eq.${encodeURIComponent(group)}&select=gym_group,kind`))[0],
      { timeout: 20_000 },
    )
    .toEqual({ gym_group: true, kind: 'project' });
  if (desktop) {
    await expect(page.getByRole('navigation').getByRole('link', { name: group })).toBeVisible();
  }

  // Sozinho no grupo, o Modo Treino ainda pergunta e oferece o convite (antes começava direto)
  const [folder] = await adminRest(`folders?name=eq.${encodeURIComponent(group)}&select=id`);
  const [workout] = await adminRest('pages', {
    method: 'POST',
    body: JSON.stringify({ folder_id: folder.id, name: `Costas ${stamp}`, view_type: 'cards' }),
  });
  await page.goto(`/treino/${workout.id}`);
  await expect(page.getByRole('heading', { name: 'Quem está treinando junto agora?' })).toBeVisible(
    { timeout: 20_000 },
  );
  await expect(page.getByText(/Ainda é só você aqui/)).toBeVisible();
  await page.getByRole('button', { name: 'Convidar pessoas' }).click();
  await expect(shown(page, 'Compartilhar').first()).toBeVisible({ timeout: 20_000 });
});
