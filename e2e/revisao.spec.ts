import { expect, test } from '@playwright/test';

import { adminRest, signUp } from './helpers';

test('revisão semanal: concluí, atrasada ganha data nova, próxima semana e concluir salva', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await signUp(page, testInfo);
  const stamp = `${testInfo.project.name} ${Date.now()}`;
  const doneTitle = `Ligar para a escola ${stamp}`;
  const lateTitle = `Pagar o condomínio ${stamp}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  for (const title of [doneTitle, lateTitle]) {
    await input.fill(`${title} hoje`);
    await input.press('Enter');
  }
  await expect
    .poll(
      async () =>
        (await adminRest(`tasks?title=in.("${doneTitle}","${lateTitle}")&select=id`)).length,
      { timeout: 20_000 },
    )
    .toBe(2);
  await page.getByRole('checkbox', { name: `Concluir ${doneTitle}` }).click();
  await expect
    .poll(
      async () =>
        (
          await adminRest(
            `tasks?title=eq.${encodeURIComponent(doneTitle)}&status=eq.done&select=id`,
          )
        ).length,
      { timeout: 20_000 },
    )
    .toBe(1);
  // Dois dias atrás: "ontem" em UTC pode ser hoje no fuso da conta perto da meia-noite
  const past = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
  await adminRest(`tasks?title=eq.${encodeURIComponent(lateTitle)}`, {
    method: 'PATCH',
    body: JSON.stringify({ due_date: past }),
  });

  await page.goto('/revisao');
  await expect(page.getByText(`✓ ${doneTitle}`)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('1 tarefa concluída')).toBeVisible();

  await page.getByRole('button', { name: 'Próximo' }).click();
  const actions = page.getByLabel(`Nova data para ${lateTitle}`);
  await actions.getByRole('button', { name: 'Amanhã' }).click();
  await expect(page.getByText('Nada atrasado.')).toBeVisible();

  await page.getByRole('button', { name: 'Próximo' }).click();
  await expect(page.getByText('Nada parado.')).toBeVisible();

  await page.getByRole('button', { name: 'Próximo' }).click();
  await expect(page.getByRole('checkbox', { name: `Concluir ${lateTitle}` })).toBeVisible();

  const saved = page.waitForResponse(
    (r) => r.url().includes('/profiles') && r.request().method() === 'PATCH' && r.ok(),
  );
  await page.getByRole('button', { name: 'Concluir revisão' }).click();
  await saved;
  await expect(page.getByRole('alert').filter({ hasText: 'Revisão feita' })).toBeVisible();
});
