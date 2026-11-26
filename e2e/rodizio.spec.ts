import { devices, expect, test } from '@playwright/test';

import { adminRest, signUp } from './helpers';

// CS2 (D381): rodízio de quem faz. Concluir passa a vez, pular avisa a próxima pessoa, e a
// contagem de quem fez quanto aparece na ordem.
test('rodízio: a vez passa ao concluir e pular avisa a próxima', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'celular',
    'O teste abre o segundo navegador por conta própria',
  );
  test.setTimeout(120_000);

  await signUp(page, testInfo);
  await page.goto('/templates');
  await page.getByRole('button', { name: 'Modelo Churrasco' }).click();
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Churrasco' })).toBeVisible();

  // Ana cria a tarefa da casa
  await page.getByRole('link', { name: 'Compras' }).first().click();
  const title = `Lavar a louça ${Date.now()}`;
  const created = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  await page.getByRole('textbox', { name: 'Nova tarefa' }).fill(title);
  await page.keyboard.press('Enter');
  await created;
  const [{ id }] = await adminRest(`tasks?title=eq.${encodeURIComponent(title)}&select=id`);

  // Bia entra no projeto
  await page.getByRole('button', { name: 'Voltar' }).click();
  await page.getByRole('button', { name: 'Pessoas' }).click();
  await page.getByRole('button', { name: 'Gerar link de convite' }).click();
  const link = (await page.getByLabel('Link de convite').textContent()) ?? '';
  const context = await browser.newContext({ ...devices['Desktop Chrome'] });
  const bia = await context.newPage();
  await bia.goto(link);
  await bia.getByPlaceholder('Seu nome').fill('Bia Reis');
  await bia
    .getByPlaceholder('E-mail')
    .fill(`e2e-rodizio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@teste.local`);
  await bia.getByPlaceholder('Senha').fill('senha-forte-123');
  await bia.getByRole('checkbox', { name: /aceito os Termos/ }).click();
  await bia.getByRole('button', { name: 'Criar conta' }).click();
  await bia.getByRole('button', { name: 'Participar' }).click();
  await expect(bia.getByRole('heading', { name: 'Churrasco' })).toBeVisible();

  // Liga o rodízio com as duas, Ana primeiro
  await page.goto(`/task/${id}`);
  await page.getByRole('button', { name: 'Fazer rodízio' }).click();
  await expect(page.getByRole('checkbox', { name: 'Bia Reis' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('button', { name: 'Salvar rodízio' }).click();
  await expect(page.getByText('Rodízio salvo.')).toBeVisible();
  await expect(page.getByText(/^Vez de Teste E2E/)).toBeVisible();

  // Ana conclui: a vez passa para a Bia, com a contagem
  const done = page.waitForResponse((r) => /rpc\/(complete_task|run_once)/.test(r.url()) && r.ok());
  await page.getByRole('checkbox', { name: 'Concluir', exact: true }).click();
  await done;
  await expect(async () => {
    await page.reload();
    await expect(page.getByText(/^Vez de Bia Reis/)).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByLabel('Teste E2E: 1 no total, 1 nesta semana')).toBeVisible();

  // Ana (que escolhe responsáveis) pula a vez da Bia: volta para ela mesma
  await page.getByRole('button', { name: 'Pular a vez' }).click();
  await expect(page.getByText(/^Vez de Teste E2E/)).toBeVisible();

  // A Bia foi avisada quando a vez chegou a ela
  await bia.goto('/notifications');
  await expect(bia.getByText(title, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
  await context.close();
});
