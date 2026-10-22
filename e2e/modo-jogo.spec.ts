import { expect, test } from '@playwright/test';

import { adminRest, openTab, signUp } from './helpers';

// HB3 e HB4 (ESCOPO_V8): três níveis de jogo no Perfil; no Completo o Início vira o acampamento.
test('modo jogo: Completo mostra o acampamento no Início', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Perfil');
  const level = page.getByRole('radiogroup', { name: 'Gamificação' });
  await expect(level.getByRole('radio', { name: 'Discreto' })).toHaveAttribute('aria-checked', 'true');

  const saved = page.waitForResponse((r) => r.url().includes('/profiles') && r.ok());
  await level.getByRole('radio', { name: 'RPG' }).click();
  await saved;
  await openTab(page, 'Início');
  const camp = page.getByLabel('Acampamento');
  await expect(camp).toBeVisible();
  await expect(camp.getByRole('heading', { name: 'Teste' })).toBeVisible();
  await expect(camp.getByText('Bosses')).toBeVisible();
  // O boss tem uma fala (entre aspas)
  await expect(camp.getByText(/^“.+”$/).first()).toBeVisible();

  // Voltar ao Discreto tira o acampamento
  await openTab(page, 'Perfil');
  const back = page.waitForResponse((r) => r.url().includes('/profiles') && r.ok());
  await level.getByRole('radio', { name: 'Discreto' }).click();
  await back;
  await openTab(page, 'Início');
  await expect(page.getByLabel('Acampamento')).toHaveCount(0);
});

const userIdOf = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    return JSON.parse(localStorage.getItem(key ?? '') ?? '{}').user?.id as string;
  });

// HB5 a HB10: virada do dia com "o que você fez ontem?", recompensa, mascote e morte
test('modo jogo: virada do dia, recompensa, mascote e morte', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'fluxo longo: basta um perfil');
  test.setTimeout(120_000);
  await signUp(page, testInfo);
  const me = await userIdOf(page);
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA', {
    timeZone: 'America/Sao_Paulo',
  });
  const [inbox] = await adminRest(
    `pages?is_inbox=eq.true&select=id,folders!inner(owner_id)&folders.owner_id=eq.${me}`,
  );
  await adminRest('tasks', {
    method: 'POST',
    body: JSON.stringify({
      page_id: inbox.id,
      title: 'Alongar',
      recurrence: { type: 'daily' },
      due_date: yesterday,
      priority: 3,
      created_by: me,
    }),
  });
  // Completo, já contando desde ontem, com ouro e um ovo e uma poção
  await adminRest(`profiles?id=eq.${me}`, {
    method: 'PATCH',
    body: JSON.stringify({ game_mode: 'full', hp_day: yesterday }),
  });
  await adminRest('xp_events', {
    method: 'POST',
    body: JSON.stringify({ user_id: me, kind: 'task', amount: 0, gold: 200, day: yesterday }),
  });
  await adminRest('user_stacks', {
    method: 'POST',
    body: JSON.stringify([
      { user_id: me, kind: 'egg', key: 'lobo', qty: 1 },
      { user_id: me, kind: 'potion', key: 'gelo', qty: 1 },
    ]),
  });
  await page.reload();

  // "O que você fez ontem?": a diária perdida tira vida
  await expect(page.getByRole('heading', { name: 'O que você fez ontem?' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText('Alongar').first()).toBeVisible();
  await page.getByRole('button', { name: 'Começar o dia' }).click();
  await expect(page.getByText(/Uma diária ficou para trás: −4 de vida/)).toBeVisible();
  await openTab(page, 'Início');
  await expect(page.getByLabel('Acampamento').getByText('❤ 46/50 de vida')).toBeVisible();

  // Recompensa: criar e resgatar com o ouro
  await page.goto('/recompensas');
  await page.getByRole('button', { name: '+ Nova recompensa' }).click();
  await page.getByPlaceholder('O que é (ex.: um episódio de série)').fill('Um episódio');
  await page.getByPlaceholder('Preço em ouro').fill('30');
  await page
    .getByRole('button', { name: /Salvar|OK|Criar/ })
    .last()
    .click();
  await page.getByRole('button', { name: 'Resgatar por 30' }).click();
  await expect(page.getByText('🎁 Aproveite: Um episódio')).toBeVisible();

  // Estábulo: ovo + poção = mascote
  await page.goto('/estabulo');
  await page.getByRole('tab', { name: 'Mascotes' }).click();
  await page.getByRole('button', { name: /Chocar Lobo do gelo/ }).click();
  await expect(page.getByText('🐣 Nasceu: Lobo do gelo!')).toBeVisible();

  // Morte: recomeçar do nível 1
  await adminRest(`profiles?id=eq.${me}`, {
    method: 'PATCH',
    body: JSON.stringify({ dead: true, hp: 0 }),
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Seu personagem caiu' })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Recomeçar do nível 1' }).click();
  await page.getByRole('button', { name: 'Recomeçar do nível 1' }).last().click();
  await expect(page.getByText('Uma nova jornada começa no nível 1.')).toBeVisible();
});
