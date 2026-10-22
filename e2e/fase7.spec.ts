import { expect, test, type Locator } from '@playwright/test';

import { ageTask, createPage, shown, signUp, isRpc } from './helpers';

test('personagem: escolher classe, ver o golpe e a habilidade do dia', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  await page.goto('/character');
  await expect(page.getByRole('heading', { name: 'Escolha sua classe' })).toBeVisible();
  await page.getByRole('button', { name: 'Escolher Lutador' }).click();

  await expect(page.getByRole('heading', { name: 'Personagem' })).toBeVisible();
  await expect(page.getByLabel('Força: 4')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mais um ponto em Força' })).toBeDisabled();
  // A conta do dano fica recolhida (D268)
  await expect(shown(page, 'Seu golpe agora')).toHaveCount(0);
  await page.getByRole('button', { name: 'Como funciona o dano' }).click();
  await expect(shown(page, 'Seu golpe agora')).toBeVisible();

  const skill = page.waitForResponse((r) => r.url().includes('use_skill') && r.ok());
  await page.getByRole('button', { name: 'Usar Fúria' }).click();
  await skill;
  await expect(page.getByRole('button', { name: 'Ativa até o fim do dia' })).toBeVisible();

  // Loja: sem ouro, nada à venda fica disponível; os de boss nem têm preço
  await page.goto('/shop');
  await expect(page.getByRole('button', { name: 'Comprar Boné por 40 de ouro' })).toBeDisabled();
  await expect(shown(page, 'Só cai de boss').first()).toBeVisible();
});

test('tarefa concluída na hora não dá XP, mas bate no boss', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  const title = `Rápida ${Date.now()}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' }).first();
  const created = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  await input.fill(title);
  await input.press('Enter');
  await created;
  const done = page.waitForResponse((r) => isRpc(r, 'complete_task'));
  await page.getByRole('checkbox', { name: new RegExp(title) }).click();
  await done;
  await expect(page.getByText(/Concluída: Rápida \d+ · ⚔️ \d+ de dano/)).toBeVisible();
});

test('hábitos: contador com meta e bom/ruim com + e −', async ({ page }, testInfo) => {
  // A aba Hoje continua montada (com aria-hidden) atrás da página e mostra os mesmos hábitos
  const onScreen = (l: Locator) => l.and(page.locator(':not([aria-hidden="true"] *)'));
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Rotina', name: 'Hábitos', type: 'Hábitos' });
  // Títulos únicos: o ageTask acha a tarefa pelo título, e o banco é compartilhado entre os testes
  const id = `${testInfo.project.name} ${Date.now()}`;
  const water = `Beber água ${id}`;
  const food = `Comer bem ${id}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  for (const title of [water, food]) {
    const created = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
    await input.fill(title);
    await input.press('Enter');
    await created;
    await ageTask(title);
  }

  // Contador com meta 2
  await page.getByRole('button', { name: `Detalhes de ${water}` }).click();
  await page.getByRole('radio', { name: /Contador/ }).click();
  const meta = page.getByLabel('Meta por período');
  await meta.fill('2');
  const saved = page.waitForResponse((r) => r.url().includes('/rest/v1/tasks') && r.ok());
  await meta.press('Enter');
  await saved;
  await page.getByRole('button', { name: 'Voltar' }).click();

  await page.getByRole('button', { name: `Mais um: ${water}` }).click();
  await expect(onScreen(page.getByLabel('1 de 2'))).toBeVisible();
  const goal = page.waitForResponse((r) => isRpc(r, 'habit_tick'));
  await page.getByRole('button', { name: `Mais um: ${water}` }).click();
  await goal;
  await expect(onScreen(page.getByLabel('2 de 2'))).toBeVisible();
  await expect(page.getByText(new RegExp(`${water}: 2/2 · \\+\\d+ XP`))).toBeVisible();
  await expect(page.getByRole('button', { name: `Mais um: ${water}` })).toBeDisabled();

  // Bom e ruim
  await page.getByRole('button', { name: `Detalhes de ${food}` }).click();
  const kind = page.waitForResponse((r) => r.url().includes('/rest/v1/tasks') && r.ok());
  await page.getByRole('radio', { name: /Bom e ruim/ }).click();
  await kind;
  await page.getByRole('button', { name: 'Voltar' }).click();

  const plus = page.waitForResponse((r) => isRpc(r, 'habit_tick'));
  await page.getByRole('button', { name: `Hábito bom: ${food}` }).click();
  await plus;
  await expect(page.getByText(`👍 ${food} · +3 XP`, { exact: false })).toBeVisible();
  await page.getByRole('button', { name: `Hábito ruim: ${food}` }).click();
  await expect(onScreen(page.getByLabel('Hoje: 1 bons, 1 ruins'))).toBeVisible();
  // Desfazer o − (o aviso dele é o último)
  const undo = page.waitForResponse((r) => isRpc(r, 'undo_habit_tick'));
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await undo;
  await expect(onScreen(page.getByLabel('Hoje: 1 bons, 0 ruins'))).toBeVisible();
  // HB2: depois de um + (desfeito o −), a força é "neutra" (valor 1)
  await expect(onScreen(page.getByLabel('Força do hábito: neutra'))).toBeVisible();

  // HB2: só ruim esconde o + e o − baixa a força
  await page.getByRole('button', { name: `Detalhes de ${food}` }).click();
  const side = page.waitForResponse((r) => r.url().includes('/rest/v1/tasks') && r.ok());
  await page.getByRole('radio', { name: 'Só ruim (−)' }).click();
  await side;
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page.getByRole('button', { name: `Hábito bom: ${food}` })).toHaveCount(0);
  const minus = page.waitForResponse((r) => isRpc(r, 'habit_tick'));
  await page.getByRole('button', { name: `Hábito ruim: ${food}` }).click();
  await minus;
  await page.getByRole('button', { name: `Hábito ruim: ${food}` }).click();
  await expect(onScreen(page.getByLabel('Força do hábito: em queda'))).toBeVisible();
});

test('atalho de tema claro/escuro', async ({ page }, testInfo) => {
  // O atalho fica na barra lateral; no celular o tema muda em Configurações (D258)
  test.skip(testInfo.project.name === 'celular', 'Atalho só na barra lateral');
  await page.emulateMedia({ colorScheme: 'light' });
  await signUp(page, testInfo);
  const html = page.locator('html');
  await expect(html).not.toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Usar tema escuro' }).first().click();
  await expect(html).toHaveClass(/dark/);
  await page.reload();
  await expect(html).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Usar tema claro' }).first().click();
  await expect(html).not.toHaveClass(/dark/);
});
