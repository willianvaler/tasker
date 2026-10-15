import { expect, test } from '@playwright/test';

import {
  adminRest,
  ageTask,
  createPage,
  isRpc,
  openTab,
  shown,
  signUp,
  waitForSync,
} from './helpers';

const serverTask = async (title: string) =>
  (await adminRest(`tasks?title=eq.${encodeURIComponent(title)}&select=id,status`))[0];

test('repetições: "3x12" na captura, cada série conta e a última conclui; desfazer reabre', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Flexões 3x12');
  await input.press('Enter');

  const more = (done: number) =>
    page.getByRole('button', { name: `Mais uma em Flexões (${done} de 3)` });
  await expect(more(0)).toBeVisible();
  await more(0).click();
  await expect(page.getByText('Flexões: 1/3').first()).toBeVisible();
  await more(1).click();
  await expect(page.getByRole('checkbox', { name: 'Concluir Flexões' })).toBeVisible();

  // A terceira conclui (pelo servidor, com o XP de sempre) e a tarefa sai das abertas
  const done = page.waitForResponse((r) => isRpc(r, 'log_rep'));
  await more(2).click();
  await done;
  await expect(page.getByRole('checkbox', { name: 'Concluir Flexões' })).toHaveCount(0);

  // "Desfazer" do aviso volta a 2/3 e reabre
  await page.getByRole('button', { name: 'Desfazer' }).first().click();
  await expect(more(2)).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Concluir Flexões' })).toBeVisible();
  await page.getByRole('button', { name: 'Detalhes de Flexões' }).click();
  await expect(page.getByRole('radio', { name: 'Séries' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByLabel('2 de 3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Voltar' }).click();

  // Recarregar mantém a conta (vem do servidor ou do banco do aparelho)
  await waitForSync(page);
  await page.reload();
  await expect(more(2)).toBeVisible({ timeout: 15_000 });
});

test('repetições: no card, "0/2" conta a série; "x8" vira contador', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Academia', name: 'Treino A', type: 'Cards' });
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Supino 2x10 40kg');
  await input.press('Enter');

  // O "0/2" do card conta uma série; a última conclui
  await expect(shown(page, '2x10 · 40kg')).toBeVisible();
  await page.getByRole('button', { name: 'Mais uma em Supino (0 de 2)' }).click();
  await page.getByRole('button', { name: 'Mais uma em Supino (1 de 2)' }).click();
  await expect(page.getByRole('checkbox', { name: 'Supino', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  // Tocar no card reabre (e a conta volta para 1/2)
  await page.getByRole('checkbox', { name: 'Supino', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mais uma em Supino (1 de 2)' })).toBeVisible();

  // Contador: o plano muda no painel
  await input.fill('Beber água x8');
  await input.press('Enter');
  await page.getByRole('button', { name: 'Detalhes de Beber água' }).click();
  await expect(page.getByRole('radio', { name: 'Vezes' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('textbox', { name: 'Quantas' })).toHaveValue('8');
  await page.getByRole('button', { name: 'Mais uma' }).click();
  await expect(page.getByLabel('1 de 8', { exact: true })).toBeVisible();
});

test('repetições: XP só na última série; offline fica pendente e o oficial chega ao voltar', async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  await page.goto('/inbox');
  const title = `Barra ${testInfo.project.name} ${Date.now()}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(`${title} 2x8`);
  await input.press('Enter');
  await expect
    .poll(async () => (await serverTask(title))?.status, { timeout: 20_000 })
    .toBe('todo');
  // Concluir logo depois de criar vale 0 XP (relâmpago): envelhece e espera chegar ao aparelho
  await ageTask(title);
  await expect
    .poll(
      () =>
        page.evaluate(
          async (t) =>
            (
              await (window as any).questlistDb.getOptional(
                "select 1 as ok from tasks where title = ? and julianday(created_at) < julianday('now', '-1 minute')",
                [t],
              )
            )?.ok ?? 0,
          title,
        ),
      { timeout: 20_000 },
    )
    .toBe(1);

  const more = (done: number) =>
    page.getByRole('button', { name: `Mais uma em ${title} (${done} de 2)` });
  await context.setOffline(true);
  await more(0).click();
  // A série do meio não promete XP
  await expect(page.getByRole('alert').filter({ hasText: `${title}: 1/2` })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'XP' })).toHaveCount(0);
  await more(1).click();
  // Sem resposta, o app espera até 3 s antes de mostrar o XP como pendente (o CI é lento)
  await expect(page.getByRole('alert').filter({ hasText: '+~10 XP (pendente)' })).toBeVisible({
    timeout: 15_000,
  });

  await context.setOffline(false);
  await expect
    .poll(async () => (await serverTask(title))?.status, { timeout: 30_000 })
    .toBe('done');
  await expect(page.getByText('+10 XP pendente')).toHaveCount(0, { timeout: 15_000 });
  if (testInfo.project.name === 'desktop')
    await expect(page.getByRole('navigation').getByText(/^10\/\d+ XP$/)).toBeVisible();
});
