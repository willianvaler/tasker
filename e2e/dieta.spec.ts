import { expect, test } from '@playwright/test';

import { adminRest, isRpc, openTab, shown, signUp } from './helpers';

const userIdOf = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    return JSON.parse(localStorage.getItem(key ?? '') ?? '{}').user?.id as string;
  });

// "Hoje" no fuso do perfil (o das contas de teste é o de São Paulo)
const todayParts = () => {
  const now = new Date();
  const day = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(now);
  const index = [
    'domingo',
    'segunda-feira',
    'terça-feira',
    'quarta-feira',
    'quinta-feira',
    'sexta-feira',
    'sábado',
  ].indexOf(day);
  return { day, index };
};

// BE2 (D275): cardápio da semana no Bem-estar, prato de hoje para marcar e lista de compras
test('dieta: montar o cardápio, prato de hoje e lista de compras', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  const me = await userIdOf(page);
  await openTab(page, 'Bem-estar');
  await page.getByRole('button', { name: 'Montar o cardápio da semana' }).click();
  // Logo depois de criar a conta a primeira sincronização ainda está baixando o catálogo de
  // exercícios: com outros testes em paralelo, criar a pasta e a lista passa dos 5 s
  await expect(page.getByRole('heading', { name: 'Cardápio da semana' })).toBeVisible({
    timeout: 20_000,
  });

  const { day: dayName, index } = todayParts();
  // Os cartões do cardápio mostram o dia com maiúscula
  const day = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  await page.getByRole('button', { name: `Pôr prato no Almoço de ${day}` }).click();
  await page.getByRole('textbox', { name: 'Nome do prato' }).fill('Frango grelhado');
  await page.getByRole('textbox', { name: 'Ingredientes' }).fill('200 g de frango\narroz');
  const created = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await created;
  await expect(
    page
      .getByLabel(day, { exact: true })
      .getByRole('button', { name: 'Detalhes de Frango grelhado' }),
  ).toBeVisible();

  const [dish] = await adminRest(
    `tasks?select=meta,due_date,pages!inner(name,reset_cycle,folders!inner(owner_id))&pages.folders.owner_id=eq.${me}&title=eq.Frango grelhado`,
  );
  expect(dish).toMatchObject({
    meta: { meal: 'lunch', days: [index] },
    due_date: null,
    pages: { name: 'Cardápio da semana', reset_cycle: 'weekly' },
  });

  // Lista de compras da semana: vai para a criação em lote, para conferir
  await page.getByRole('button', { name: 'Gerar lista de compras' }).click();
  await page.getByRole('menuitem', { name: 'Caixa de entrada' }).click();
  await expect(page.getByText('Frango (200 g)', { exact: true }).last()).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Voltar' }).first().click();

  // No Bem-estar, o prato de hoje com a caixinha; marcar conclui os ingredientes junto
  await openTab(page, 'Bem-estar');
  await expect(shown(page, 'Cardápio de hoje')).toBeVisible();
  const done = page.waitForResponse((r) => isRpc(r, 'complete_tree'));
  await page.getByRole('checkbox', { name: 'Concluir Frango grelhado' }).click();
  await done;
  await expect(page.getByRole('checkbox', { name: 'Reabrir Frango grelhado' })).toBeVisible();
});

// BE3 (D275): hábitos prontos entram na tela Hábitos
test('vida saudável: adicionar um hábito pronto', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  const me = await userIdOf(page);
  await openTab(page, 'Bem-estar');
  const added = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  await page.getByRole('button', { name: 'Adicionar o hábito Beber um copo de água' }).click();
  await added;
  await expect(
    page.getByRole('button', { name: 'Beber um copo de água já está nos hábitos' }),
  ).toBeVisible();
  const [habit] = await adminRest(
    `tasks?select=habit_kind,habit_target,pages!inner(is_habits,folders!inner(owner_id))&pages.folders.owner_id=eq.${me}&title=eq.Beber um copo de água`,
  );
  expect(habit).toMatchObject({
    habit_kind: 'counter',
    habit_target: 8,
    pages: { is_habits: true },
  });
});
