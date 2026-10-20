import { devices, expect, test } from '@playwright/test';

import { adminRest, signUp } from './helpers';

test('reações: Bia reage à conclusão da Ana no feed do projeto e a Ana é avisada', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'celular',
    'O teste abre o segundo navegador por conta própria',
  );
  test.setTimeout(90_000);

  // Ana cria o projeto pelo modelo e conclui uma tarefa
  await signUp(page, testInfo);
  await page.goto('/templates');
  await page.getByRole('button', { name: 'Modelo Churrasco' }).click();
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Churrasco' })).toBeVisible();
  await page.getByRole('link', { name: 'Compras' }).first().click();
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  const created = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  const title = `Carvão ${Date.now()}`;
  await input.fill(title);
  await input.press('Enter');
  await created;
  await page.getByRole('checkbox', { name: `Concluir ${title}` }).click();
  // Concluir passa pela fila (run_once): espera chegar ao servidor
  await expect
    .poll(
      async () =>
        (await adminRest(`tasks?title=eq.${encodeURIComponent(title)}&status=eq.done&select=id`))
          .length,
      { timeout: 20_000 },
    )
    .toBe(1);

  // Convite
  await page.getByRole('button', { name: 'Voltar' }).click();
  await page.getByRole('button', { name: 'Pessoas' }).click();
  await page.getByRole('button', { name: 'Gerar link de convite' }).click();
  const link = (await page.getByLabel('Link de convite').textContent()) ?? '';

  // Bia entra e reage no feed de atividade
  const context = await browser.newContext({ ...devices['Desktop Chrome'] });
  const bia = await context.newPage();
  await bia.goto(link);
  await bia.getByPlaceholder('Seu nome').fill('Bia Reis');
  await bia
    .getByPlaceholder('E-mail')
    .fill(`e2e-reacao-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@teste.local`);
  await bia.getByPlaceholder('Senha').fill('senha-forte-123');
  await bia.getByRole('checkbox', { name: /aceito os Termos/ }).click();
  await bia.getByRole('button', { name: 'Criar conta' }).click();
  await bia.getByRole('button', { name: 'Participar' }).click();
  await expect(bia.getByRole('heading', { name: 'Churrasco' })).toBeVisible();
  await expect(bia.getByText(`concluiu "${title}"`, { exact: false })).toBeVisible({
    timeout: 20_000,
  });
  await bia.getByRole('button', { name: 'Reagir', exact: true }).first().click();
  const reacted = bia.waitForResponse((r) => r.url().includes('/reactions') && r.ok());
  await bia.getByRole('button', { name: 'Reagir com 👏 (0)' }).click();
  await reacted;
  await expect(bia.getByRole('button', { name: 'Reagir com 👏 (1)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Ana vê a reação na tarefa e o aviso no 🔔
  await page.goto('/notifications');
  const notice = page.getByText(`Bia Reis reagiu 👏 a "${title}"`);
  await expect(notice).toBeVisible({ timeout: 20_000 });
  await notice.click();
  await expect(page.getByText('Reações à conclusão')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reagir com 👏 (1)' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await context.close();
});
