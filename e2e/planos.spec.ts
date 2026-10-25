import { expect, test } from '@playwright/test';

import { adminRest, signUp } from './helpers';

const userIdOf = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    return JSON.parse(localStorage.getItem(key ?? '') ?? '{}').user?.id as string;
  });

// AC12.1: um plano pronto vira uma pasta na Academia com os treinos, os dias, a progressão e os
// exercícios ligados à biblioteca (liga a Academia se ainda estiver desligada)
test('planos prontos: usar o ABC monta a pasta com os três treinos', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  const me = await userIdOf(page);
  // Treino ainda desligado: usar o plano liga a Academia sozinho
  await page.goto('/planos');
  await expect(page.getByRole('heading', { name: 'Planos prontos' })).toBeVisible();
  const abc = page.getByLabel('ABC', { exact: true });
  await abc.getByRole('button', { name: 'Ver os treinos' }).click();
  await expect(abc.getByText('B: costas e bíceps')).toBeVisible();
  await expect(abc.getByText('Supino reto com barra (pegada média)')).toBeVisible();

  // Em casa só mostra o plano sem equipamento
  await page.getByRole('radio', { name: 'Em casa' }).click();
  await expect(page.getByLabel('Em casa, sem equipamento', { exact: true })).toBeVisible();
  await expect(page.getByLabel('ABC', { exact: true })).toHaveCount(0);
  await page.getByRole('radio', { name: 'Todos' }).click();

  await page.getByRole('button', { name: 'Usar o plano ABC', exact: true }).click();
  await expect(page.getByText('Plano ABC criado na Academia')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: /ABC$/ })).toBeVisible();

  await expect
    .poll(async () => {
      const pages = await adminRest(
        `pages?select=name,train_days,progression,view_type,reset_cycle,folders!inner(name,owner_id,parent_id)&folders.owner_id=eq.${me}&folders.name=eq.ABC&order=position`,
      );
      return pages.map((p: { name: string; train_days: number[]; progression: string }) => [
        p.name,
        p.train_days,
        p.progression,
      ]);
    })
    .toEqual([
      ['A: peito, ombro e tríceps', [1], 'double'],
      ['B: costas e bíceps', [3], 'double'],
      ['C: pernas', [5], 'double'],
    ]);
  const tasks = await adminRest(
    `tasks?select=title,exercise_id,repeat_plan,meta,pages!inner(name,folders!inner(owner_id))&pages.folders.owner_id=eq.${me}&pages.name=eq.C: pernas&order=position`,
  );
  expect(tasks[0]).toMatchObject({
    title: 'Agachamento com barra',
    exercise_id: 'free-Barbell_Squat',
    repeat_plan: { mode: 'sets', total: 4, rest_seconds: 120 },
    meta: { sets: 4, reps: 10 },
  });
  expect(tasks).toHaveLength(6);
});

// Exercício por tempo ganha a regra "tempo" (a prancha do plano de casa)
test('planos prontos: em casa, prancha por tempo', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'basta um perfil');
  await signUp(page, testInfo);
  const me = await userIdOf(page);
  await page.goto('/planos');
  await page.getByRole('button', { name: 'Usar o plano Em casa, sem equipamento' }).click();
  await expect(page.getByText('Plano Em casa, sem equipamento criado na Academia')).toBeVisible({
    timeout: 20_000,
  });
  await expect
    .poll(async () => {
      const rows = await adminRest(
        `tasks?select=title,progression,repeat_plan,pages!inner(name,folders!inner(owner_id))&pages.folders.owner_id=eq.${me}&exercise_id=eq.free-Plank`,
      );
      return rows.map((r: { progression: string; repeat_plan: { mode: string } }) => [
        r.progression,
        r.repeat_plan.mode,
      ]);
    })
    .toEqual([['time', 'timed']]);
});

// AC12.3: levar exercícios de um treino para outro (copiar e mover, um ou vários)
test('levar exercícios para outro treino: copiar e mover', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  const me = await userIdOf(page);
  await page.goto('/planos');
  await page.getByRole('button', { name: 'Usar o plano 5×5' }).click();
  await expect(page.getByText('Plano 5×5 criado na Academia')).toBeVisible({ timeout: 20_000 });
  const [a] = await adminRest(
    `pages?select=id,folders!inner(owner_id)&folders.owner_id=eq.${me}&name=eq.5×5 A`,
  );
  await page.goto(`/page/${a.id}`);
  await expect(page.getByRole('heading', { name: /5×5 A$/ })).toBeVisible();

  const open = async () => {
    await page.getByRole('button', { name: 'Opções da lista' }).click();
    await page.getByRole('menuitem', { name: 'Levar exercícios para outro treino' }).click();
  };
  const titlesIn = (name: string) =>
    adminRest(
      `tasks?select=title,exercise_id,repeat_plan,pages!inner(name,folders!inner(owner_id))&pages.folders.owner_id=eq.${me}&pages.name=eq.${encodeURIComponent(name)}&order=position`,
    ).then((rows: { title: string }[]) => rows.map((r) => r.title));

  // Copiar todos para o B: o A continua com os três
  await open();
  await page.getByRole('checkbox', { name: 'Todos' }).click();
  await expect(page.getByText('3 marcados')).toBeVisible();
  await page
    .getByRole('radiogroup', { name: 'Para qual treino?' })
    .getByRole('radio', { name: '5×5 B' })
    .click();
  await page.getByRole('button', { name: 'Copiar', exact: true }).click();
  await expect(page.getByText('3 exercícios copiados para 5×5 B')).toBeVisible();
  await expect
    .poll(() => titlesIn('5×5 B'))
    .toEqual([
      'Agachamento com barra',
      'Desenvolvimento militar em pé',
      'Levantamento terra com barra',
      'Agachamento com barra',
      'Supino reto com barra (pegada média)',
      'Remada curvada com barra',
    ]);
  const copied = await adminRest(
    `tasks?select=exercise_id,repeat_plan,pages!inner(name,folders!inner(owner_id))&pages.folders.owner_id=eq.${me}&pages.name=eq.${encodeURIComponent('5×5 B')}&title=eq.${encodeURIComponent('Remada curvada com barra')}`,
  );
  expect(copied[0]).toMatchObject({
    exercise_id: 'mit-0027',
    repeat_plan: { mode: 'sets', total: 5, rest_seconds: 180 },
  });

  // Mover só a remada: sai do A
  await open();
  // A lista atrás também tem o checkbox da remada; o do diálogo é o último
  await page.getByRole('checkbox', { name: 'Remada curvada com barra' }).last().click();
  await page
    .getByRole('radiogroup', { name: 'Para qual treino?' })
    .getByRole('radio', { name: '5×5 B' })
    .click();
  await page.getByRole('button', { name: 'Mover', exact: true }).click();
  await expect(page.getByText('1 exercício movido para 5×5 B')).toBeVisible();
  await expect
    .poll(() => titlesIn('5×5 A'))
    .toEqual(['Agachamento com barra', 'Supino reto com barra (pegada média)']);
});

// AC12.3 (D276): arrastar um exercício de um treino para outro na tela Organizar treinos
test('organizar treinos: arrastar move ou copia para outro treino', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  const me = await userIdOf(page);
  await page.goto('/planos');
  await page.getByRole('button', { name: 'Usar o plano 5×5' }).click();
  await expect(page.getByText('Plano 5×5 criado na Academia')).toBeVisible({ timeout: 20_000 });
  await page.goto('/organizar-treinos');
  await expect(page.getByRole('heading', { name: 'Organizar treinos' })).toBeVisible();
  const columnA = page.getByLabel('5×5 A', { exact: true });
  const columnB = page.getByLabel('5×5 B', { exact: true });
  await expect(columnA.getByText('Remada curvada com barra')).toBeVisible();

  const dragTo = async (name: string) => {
    const handle = columnA.getByLabel(`Arrastar ${name} para outro treino`);
    const from = (await handle.boundingBox())!;
    const to = (await columnB.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 20, from.y + 20, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
    await page.mouse.up();
  };
  const titlesIn = (name: string) =>
    adminRest(
      `tasks?select=title,pages!inner(name,folders!inner(owner_id))&pages.folders.owner_id=eq.${me}&pages.name=eq.${encodeURIComponent(name)}&parent_task_id=is.null&order=position`,
    ).then((rows: { title: string }[]) => rows.map((r) => r.title));

  // Mover (o padrão): sai do A e entra no fim do B
  await dragTo('Remada curvada com barra');
  await expect(page.getByText('1 exercício movido para 5×5 B')).toBeVisible();
  await expect
    .poll(() => titlesIn('5×5 A'))
    .toEqual(['Agachamento com barra', 'Supino reto com barra (pegada média)']);
  await expect(columnB.getByText('Remada curvada com barra')).toBeVisible();

  // Copiar: fica nos dois
  await page.getByRole('radio', { name: 'Copiar' }).click();
  await dragTo('Supino reto com barra (pegada média)');
  await expect(page.getByText('1 exercício copiado para 5×5 B')).toBeVisible();
  await expect
    .poll(() => titlesIn('5×5 B'))
    .toEqual([
      'Agachamento com barra',
      'Desenvolvimento militar em pé',
      'Levantamento terra com barra',
      'Remada curvada com barra',
      'Supino reto com barra (pegada média)',
    ]);
  expect(await titlesIn('5×5 A')).toContain('Supino reto com barra (pegada média)');
});
