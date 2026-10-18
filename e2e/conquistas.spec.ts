import { expect, test } from '@playwright/test';

import { adminRest, ageTask, signUp, waitForSync } from './helpers';

// Capturas para revisão visual: SHOTS=pasta npm run e2e -- e2e/conquistas.spec.ts
const SHOTS = process.env.SHOTS;

// V4 §2 (P3, D180): tela de conquistas com raridade, filtros, secretas e progresso da faixa.
test('conquistas: a primeira tarefa, filtros por raridade e categoria, secreta e próxima da faixa', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  const title = `Primeira conquista ${testInfo.project.name} ${Date.now()}`;
  await input.fill(`${title} hoje`);
  await input.press('Enter');
  // Concluir logo depois de criar vale 0 XP, e sem XP o servidor não confere conquistas
  await expect(page.getByRole('checkbox', { name: `Concluir ${title}` })).toBeVisible();
  await waitForSync(page);
  await expect
    .poll(
      async () => (await adminRest(`tasks?title=eq.${encodeURIComponent(title)}&select=id`)).length,
      {
        timeout: 20_000,
      },
    )
    .toBe(1);
  await ageTask(title);
  await page.getByRole('checkbox', { name: `Concluir ${title}` }).click();
  await waitForSync(page);
  await expect
    .poll(
      async () =>
        (await adminRest(`tasks?title=eq.${encodeURIComponent(title)}&select=status`))[0]?.status,
      { timeout: 20_000 },
    )
    .toBe('done');

  await page.goto('/conquistas');
  const first = page.getByRole('listitem', {
    name: /^Primeiro passo\. Concluir a primeira tarefa\./,
  });
  await expect(first).toBeVisible({ timeout: 15_000 });
  await expect(first).toHaveAccessibleName(/Raridade: Comum\..*Conquistada em/);
  if (SHOTS)
    await page.screenshot({
      path: `${SHOTS}/conquistas-${testInfo.project.name}.png`,
      fullPage: true,
    });
  // Próxima da faixa de tarefas: 1 de 10
  await expect(page.getByText('10 tarefas: 1 de 10', { exact: true })).toBeVisible();

  // Só as lendárias
  await page.getByRole('button', { name: 'Lendária', exact: true }).click();
  await expect(page.getByRole('listitem', { name: /^Nível 100\./ })).toBeVisible();
  await expect(first).toHaveCount(0);
  await page.getByRole('button', { name: 'Lendária', exact: true }).click();

  // Especiais: a secreta aparece só com a dica
  await page.getByRole('button', { name: 'Especiais', exact: true }).click();
  await expect(
    page.getByRole('listitem', { name: /^Conquista secreta\. Tem a ver com o relógio\./ }),
  ).toBeVisible();
  await expect(page.getByText('Virada', { exact: true })).toHaveCount(0);

  // Só as conquistadas
  await page.getByRole('button', { name: 'Especiais', exact: true }).click();
  await page.getByRole('radio', { name: 'Conquistadas' }).click();
  await expect(first).toBeVisible();
  await expect(page.getByRole('listitem', { name: /^Nível 100\./ })).toHaveCount(0);
});
