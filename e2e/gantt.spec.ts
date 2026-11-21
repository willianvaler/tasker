import { expect, test } from '@playwright/test';

import { openTab, signUp, waitForSync } from './helpers';

// PC3 (V3 §6 C, D308): Gantt editável na aba do projeto. A tarefa sem data ganha o dia de hoje,
// arrastar a barra muda as datas e o menu da barra estica o fim.
test('Gantt: dar data, arrastar e esticar', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'arrastar com o mouse; no celular há o menu');
  test.setTimeout(90_000);
  const name = `Reforma ${Date.now()}`;
  const step = 'Definir o que vai ser feito';
  await signUp(page, testInfo);
  await openTab(page, 'Pastas');
  await page.getByRole('button', { name: 'Usar modelo' }).click();
  await page.getByRole('button', { name: 'Kit Reforma' }).click();
  await page.getByPlaceholder('Nome').fill(name);
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();

  await page.getByRole('tab', { name: 'Gantt' }).click();
  await page.getByRole('button', { name: step, exact: true }).click();
  const bar = page.getByRole('button', { name: new RegExp(`^${step}, de `) });
  await expect(bar).toBeVisible({ timeout: 15_000 });
  const span = async () => {
    const m = /, de (.+) a (.+)$/.exec((await bar.getAttribute('aria-label')) ?? '');
    return m ? [m[1], m[2]] : [];
  };
  const [start, end] = await span();
  expect(start).toBe(end);

  // Arrastar dois dias para a frente (dia = 32 px)
  const box = await bar.boundingBox();
  if (!box) throw new Error('sem barra');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 7; i++)
    await page.mouse.move(box.x + box.width / 2 + i * 10, box.y + box.height / 2);
  await page.mouse.up();
  await expect.poll(async () => (await span())[0], { timeout: 10_000 }).not.toBe(start);
  const [moved, movedEnd] = await span();
  expect(moved).toBe(movedEnd);

  // Menu da barra: terminar um dia depois (o começo fica)
  await bar.click();
  await page.getByRole('menuitem', { name: 'Terminar um dia depois' }).click();
  await expect.poll(async () => (await span())[1], { timeout: 10_000 }).not.toBe(moved);
  expect((await span())[0]).toBe(moved);

  // Depois de recarregar, as datas vieram do servidor
  await waitForSync(page);
  await page.reload();
  await expect(bar).toBeVisible({ timeout: 15_000 });
  const [savedStart, savedEnd] = await span();
  expect(savedStart).toBe(moved);
  expect(savedEnd).not.toBe(moved);
});

// GP2 (D314): linha de base. Salvar o plano, mover uma tarefa e ver o atraso contra ele.
test('linha de base: salvar, mover e comparar', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const name = `Obra ${Date.now()}`;
  const step = 'Definir o que vai ser feito';
  await signUp(page, testInfo);
  await openTab(page, 'Pastas');
  await page.getByRole('button', { name: 'Usar modelo' }).click();
  await page.getByRole('button', { name: 'Kit Reforma' }).click();
  await page.getByPlaceholder('Nome').fill(name);
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('tab', { name: 'Gantt' }).click();
  await page.getByRole('button', { name: step, exact: true }).click();
  const bar = page.getByRole('button', { name: new RegExp(`^${step}, de `) });
  await expect(bar).toBeVisible({ timeout: 15_000 });
  await waitForSync(page);

  await page.getByRole('button', { name: 'Salvar linha de base' }).click();
  const saved = page.waitForResponse((r) => r.url().includes('/rpc/save_baseline') && r.ok());
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await saved;
  await expect(page.getByRole('checkbox', { name: /^Plano · / })).toBeChecked();
  await expect(page.getByText('Nenhuma tarefa atrasou em relação ao plano')).toBeVisible();

  // Um dia depois: atrasou um dia contra o plano
  await bar.click();
  await page.getByRole('menuitem', { name: 'Um dia depois', exact: true }).click();
  await expect(page.getByText('1 tarefa atrasou em relação ao plano (+1 d no total)')).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByLabel(`${step}: +1 d em relação ao plano`)).toBeVisible();
});
