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
