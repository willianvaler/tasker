import { expect, test } from '@playwright/test';

import { ageTask, isRpc, signUp } from './helpers';

// O1–O4 (D161–D164): o boss do dia aparece antes do da semana, apanha junto e o aviso mostra as duas barras.
test('boss do dia: aparece antes do semanal, apanha junto e o aviso mostra as barras', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  const game = page
    .getByRole('link', { name: 'Personagem, nível, XP e boss da semana' })
    .or(page.getByLabel('Personagem e boss da semana'));
  await expect(game.getByText(/^Do dia: /)).toBeVisible();
  await expect(game.getByText('60/60 HP')).toBeVisible();
  await expect(game.getByText('300/300 HP')).toBeVisible();

  const title = `Boss do dia ${testInfo.project.name} ${Date.now()}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  const created = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  await input.fill(title);
  await input.press('Enter');
  await created;
  await ageTask(title);
  const done = page.waitForResponse((r) => isRpc(r, 'complete_task'));
  await page.getByRole('checkbox', { name: `Concluir ${title}` }).click();
  await done;
  // 11 de dano (21 no crítico): 60 → 49 ou 39; 300 → 289 ou 279
  await expect(
    page.getByText(/(⚔️ 11|💥 21) de dano.* · dia (49|39)\/60 · semana (289|279)\/300/),
  ).toBeVisible();
  await expect(game.getByText(/^(49|39)\/60 HP$/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('hoje.png') });
});
