import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';

import { createPage, shown, signUp } from './helpers';

/** Treinador: cria o link de envio no modo pedido e devolve o endereço. */
async function makeLink(page: Page, mode: 'Ao vivo' | 'Cópia') {
  await page.getByRole('button', { name: 'Opções da página' }).click();
  await shown(page, 'Enviar para…').click();
  await page.getByRole('radio', { name: mode, exact: true }).click();
  await page.getByRole('button', { name: 'Criar link e copiar' }).click();
  const link = await page.getByLabel('Link para enviar').textContent();
  expect(link).toContain('/enviada/');
  return link ?? '';
}

/** Aluno novo: abre o link, cria a conta ali mesmo e recebe. */
async function receive(browser: Browser, testInfo: TestInfo, link: string, name: string) {
  const context = await browser.newContext({ ...testInfo.project.use, locale: 'pt-BR' });
  const page = await context.newPage();
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Treino A' })).toBeVisible();
  await page.getByPlaceholder('Seu nome').fill(name);
  await page
    .getByPlaceholder('E-mail')
    .fill(`e2e-aluno-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@teste.local`);
  await page.getByPlaceholder('Senha').fill('senha-forte-123');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.getByRole('button', { name: 'Receber a página' }).click();
  return page;
}

test('enviar página: link ao vivo (aluna só executa) e cópia (vira dele); e-mail pendente', async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Academia', name: 'Treino A', type: 'Cards' });
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  for (const line of ['Supino 2x10 40kg', 'Alongar']) {
    await input.fill(line);
    await input.press('Enter');
  }
  await expect(page.getByRole('checkbox', { name: 'Alongar', exact: true })).toBeVisible();
  const live = await makeLink(page, 'Ao vivo');

  // Convite por e-mail fica pendente na lista
  await page.getByRole('textbox', { name: 'E-mails' }).fill('nova-pessoa@teste.local');
  await page.getByRole('button', { name: 'Enviar convites' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /^Convites criados: 1/ })).toBeVisible();
  await expect(page.getByText('ao vivo · pendente')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar' }).last().click();

  // A aluna cai direto na página, sem a introdução e sem poder criar itens
  const ana = await receive(browser, testInfo, live, 'Ana Aluna');
  await expect(ana.getByRole('heading', { name: /Treino A$/ })).toBeVisible();
  await expect(shown(ana, /^Recebida de /)).toBeVisible();
  await expect(ana.getByRole('textbox', { name: 'Nova tarefa' })).toHaveCount(0);
  await expect(ana.getByRole('button', { name: 'Opções da página' })).toHaveCount(0);
  await ana.getByRole('checkbox', { name: 'Alongar', exact: true }).click();
  await expect(ana.getByRole('checkbox', { name: 'Alongar', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  // O "feito" é dela: no treinador continua aberto
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Alongar', exact: true })).toHaveAttribute(
    'aria-checked',
    'false',
  );

  // Cópia: a página passa a ser do aluno (pode criar itens)
  const copy = await makeLink(page, 'Cópia');
  const bruno = await receive(browser, testInfo, copy, 'Bruno Aluno');
  await expect(bruno.getByRole('heading', { name: /Treino A$/ })).toBeVisible();
  await expect(bruno.getByRole('textbox', { name: 'Nova tarefa' })).toBeVisible();
  await ana.context().close();
  await bruno.context().close();
});
