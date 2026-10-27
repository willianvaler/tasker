import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';

import { createPage, openTab, shown, signUp, waitForSync } from './helpers';

/** Treinador: cria o link de envio no modo pedido e devolve o endereço. */
async function makeLink(page: Page, mode: 'Ao vivo' | 'Cópia') {
  await page.getByRole('button', { name: 'Compartilhar' }).click();
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
  await page.getByRole('checkbox', { name: /aceito os Termos/ }).click();
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.getByRole('button', { name: 'Receber a lista' }).click();
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
  await expect(ana.getByRole('button', { name: 'Opções da lista' })).toHaveCount(0);
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

test('Recebidas: convite por e-mail aparece, receber abre a página e ela fica na seção', async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  // A aluna já tem conta
  const other = await browser.newContext({ ...testInfo.project.use, locale: 'pt-BR' });
  const ana = await other.newPage();
  const anaEmail = await signUp(ana, testInfo);

  await signUp(page, testInfo);
  await createPage(page, { folder: 'Academia', name: 'Treino A', type: 'Cards' });
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Prancha');
  await input.press('Enter');
  await page.getByRole('button', { name: 'Compartilhar' }).click();
  await shown(page, 'Enviar para…').click();
  await page.getByRole('textbox', { name: 'E-mails' }).fill(anaEmail);
  await page.getByRole('button', { name: 'Enviar convites' }).click();
  await expect(page.getByText('ao vivo · pendente')).toBeVisible();

  // Na aluna: Pastas → Recebidas → Receber
  await ana.reload();
  await openTab(ana, 'Pastas');
  const receive = ana.getByRole('button', { name: /^Receber: Treino A · de / });
  await expect(receive.first()).toBeVisible({ timeout: 15_000 });
  await receive.first().click();
  await expect(ana.getByRole('heading', { name: /Treino A$/ })).toBeVisible();
  await expect(ana.getByRole('checkbox', { name: 'Prancha', exact: true })).toBeVisible();

  // A página fica em Recebidas
  await ana.goto('/folders');
  await expect(shown(ana, 'Recebidas').first()).toBeVisible();
  await expect(ana.getByRole('link', { name: /Treino A/ }).first()).toBeVisible({
    timeout: 15_000,
  });
  await other.close();
});

test('Alunos: números, cargas, observação, lembrete e arquivar', async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Academia', name: 'Treino A', type: 'Cards' });
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  for (const line of ['Supino 2x10 40kg', 'Alongar']) {
    await input.fill(line);
    await input.press('Enter');
  }
  await expect(page.getByRole('checkbox', { name: 'Alongar', exact: true })).toBeVisible();
  const link = await makeLink(page, 'Ao vivo');
  await page.getByRole('button', { name: 'Fechar' }).last().click();

  // A aluna faz as duas séries e deixa uma observação no Alongar
  const ana = await receive(browser, testInfo, link, 'Ana Aluna');
  await ana.getByRole('button', { name: 'Mais uma em Supino (0 de 2)' }).click();
  await ana.getByRole('button', { name: 'Mais uma em Supino (1 de 2)' }).click();
  await expect(ana.getByRole('checkbox', { name: 'Supino', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await ana.getByRole('button', { name: 'Detalhes de Alongar' }).click();
  await ana.getByRole('textbox', { name: 'Observação para quem enviou' }).fill('senti o ombro');
  const noted = ana.waitForResponse((r) => r.url().includes('rpc/run_once') && r.ok());
  await ana.getByRole('button', { name: 'Salvar e marcar feito' }).click();
  await noted;
  await ana.getByRole('button', { name: 'Voltar' }).click();
  await expect(ana.getByRole('checkbox', { name: 'Alongar', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // O treinador abre "Alunos" (depois de a fila da aluna subir)
  await waitForSync(ana);
  await page.reload();
  await page.getByRole('button', { name: 'Compartilhar' }).click();
  await page.getByRole('menuitem', { name: 'Alunos' }).click();
  await expect(page.getByRole('button', { name: /^Ana Aluna: Neste ciclo: 2\/2/ })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('button', { name: /1 observação$/ })).toBeVisible();
  await page.getByRole('button', { name: /^Ana Aluna:/ }).click();
  await expect(page.getByLabel('Supino: 40kg')).toBeVisible();
  await expect(page.getByText('“senti o ombro”')).toBeVisible();
  // Painel do treinador (AC13): o diário da aluna nesta lista, com o 1RM estimado
  await expect(page.getByLabel(/^Supino: 1RM est\. .*1 sessão/)).toBeVisible({ timeout: 15_000 });

  // Lembrete chega para a aluna
  await page.getByRole('button', { name: 'Lembrar Ana Aluna' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Ana Aluna vai receber o lembrete.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lembrar Ana Aluna' })).toBeDisabled();
  await ana.goto('/notifications');
  await expect(ana.getByText(/lembrou você de "Treino A"/)).toBeVisible({ timeout: 15_000 });

  // Arquivar: sai da lista
  await page.getByRole('button', { name: 'Arquivar Ana Aluna' }).click();
  await page.getByRole('button', { name: 'Arquivar', exact: true }).click();
  await expect(page.getByText('Ninguém recebeu esta lista ao vivo ainda.')).toBeVisible();
  await ana.context().close();
});

test('plano do aluno: o treinador define a regra e a carga inicial (AC13.2)', async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Academia', name: 'Treino A', type: 'Cards' });
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Supino 2x10 40kg');
  await input.press('Enter');
  await expect(page.getByRole('checkbox', { name: 'Supino', exact: true })).toBeVisible();
  const link = await makeLink(page, 'Ao vivo');
  await page.getByRole('button', { name: 'Fechar' }).last().click();
  const ana = await receive(browser, testInfo, link, 'Ana Aluna');
  await expect(ana.getByRole('checkbox', { name: 'Supino', exact: true })).toBeVisible();
  const pageId = new URL(ana.url()).pathname.split('/').pop();

  // O treinador põe 30kg e a regra Nenhuma só para a Ana
  await page.reload();
  await page.getByRole('button', { name: 'Compartilhar' }).click();
  await page.getByRole('menuitem', { name: 'Alunos' }).click();
  await page.getByRole('button', { name: /^Ana Aluna:/ }).click({ timeout: 15_000 });
  const weight = page.getByRole('textbox', { name: 'Carga inicial de Supino' });
  await weight.fill('30kg');
  await weight.blur();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Plano de Ana Aluna salvo' }),
  ).toBeVisible();
  const rules = page.getByRole('radiogroup', { name: 'Progressão de Supino' });
  await rules.getByRole('radio', { name: 'Nenhuma' }).click();
  await expect(rules.getByRole('radio', { name: 'Nenhuma' })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // A aluna treina com 30kg, "definido pelo treinador"; o plano do treinador continua 40kg
  await ana.reload();
  await waitForSync(ana);
  await ana.goto(`/treino/${pageId}`);
  await expect(ana.getByRole('heading', { name: 'Supino' })).toBeVisible({ timeout: 20_000 });
  await expect(shown(ana, 'Definido pelo treinador')).toBeVisible({ timeout: 15_000 });
  await expect(ana.getByRole('button', { name: 'Carga desta série: 30kg' })).toBeVisible();
  await expect(page.getByPlaceholder('40kg')).toBeVisible();
  await ana.context().close();
});

test('aceite da Fase L: treino em lote para 2 alunos, cada um no seu (um offline), treinador acompanha', async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Academia', name: 'Treino A', type: 'Cards' });
  await page.getByRole('button', { name: 'Adicionar várias' }).click();
  await page
    .getByRole('textbox', { name: 'Lista de tarefas' })
    .fill('Supino 2x10 40kg\nRemada 2x12 30kg\nAlongar');
  await page.getByRole('button', { name: 'Criar 3' }).click();
  await expect(page.getByRole('checkbox', { name: 'Alongar', exact: true })).toBeVisible();
  const link = await makeLink(page, 'Ao vivo');
  await page.getByRole('button', { name: 'Fechar' }).last().click();

  const ana = await receive(browser, testInfo, link, 'Ana Aluna');
  const bruno = await receive(browser, testInfo, link, 'Bruno Aluno');
  await expect(ana.getByRole('checkbox', { name: 'Alongar', exact: true })).toBeVisible();
  await expect(bruno.getByRole('checkbox', { name: 'Alongar', exact: true })).toBeVisible();

  // Ana na academia sem sinal: Supino (2 séries) e Alongar
  await waitForSync(ana);
  await ana.context().setOffline(true);
  await ana.getByRole('button', { name: 'Mais uma em Supino (0 de 2)' }).click();
  await ana.getByRole('button', { name: 'Mais uma em Supino (1 de 2)' }).click();
  await ana.getByRole('checkbox', { name: 'Alongar', exact: true }).click();
  await expect(ana.getByRole('checkbox', { name: 'Supino', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(ana.getByRole('checkbox', { name: 'Alongar', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // Bruno, online, faz só a Remada
  await bruno.getByRole('button', { name: 'Mais uma em Remada (0 de 2)' }).click();
  await bruno.getByRole('button', { name: 'Mais uma em Remada (1 de 2)' }).click();
  await expect(bruno.getByRole('checkbox', { name: 'Remada', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await waitForSync(bruno);

  // Ana volta ao sinal: sobe tudo; ela não vê o que o Bruno fez (nem ele o dela)
  await ana.context().setOffline(false);
  await waitForSync(ana);
  await ana.reload();
  await expect(ana.getByRole('checkbox', { name: 'Remada', exact: true })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await bruno.reload();
  await expect(bruno.getByRole('checkbox', { name: 'Supino', exact: true })).toHaveAttribute(
    'aria-checked',
    'false',
  );

  // O treinador vê cada um, com as cargas
  await page.reload();
  await page.getByRole('button', { name: 'Compartilhar' }).click();
  await page.getByRole('menuitem', { name: 'Alunos' }).click();
  await expect(page.getByRole('button', { name: /^Ana Aluna: Neste ciclo: 2\/3/ })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('button', { name: /^Bruno Aluno: Neste ciclo: 1\/3/ })).toBeVisible();
  await page.getByRole('button', { name: /^Ana Aluna:/ }).click();
  await expect(page.getByLabel('Supino: 40kg')).toBeVisible();
  await page.getByRole('button', { name: /^Bruno Aluno:/ }).click();
  await expect(page.getByLabel('Remada: 30kg')).toBeVisible();
  await ana.context().close();
  await bruno.context().close();
});
