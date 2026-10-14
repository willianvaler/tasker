import { expect, test, type Page } from '@playwright/test';

import { adminRest, ageTask, shown, signUp } from './helpers';

// Protótipo do sync (D0): banco local na web, escrita offline pela fila até as RPCs, mudança do
// servidor chegando sozinha e acesso revogado tirando os dados do aparelho.
// Precisa do PowerSync local (npm run sync:start).
test.beforeAll(async () => {
  const up = await fetch('http://localhost:8095/probes/liveness').then(
    (r) => r.ok,
    () => false,
  );
  test.skip(!up, 'PowerSync local fora do ar (npm run sync:start)');
});

/** Abre a tela do sync e espera a primeira carga do banco local (com a Caixa de entrada). */
async function openSync(page: Page) {
  await page.goto('/sync');
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/No aparelho: \d+ pastas, [1-9]\d* páginas/)).toBeVisible({
    timeout: 20_000,
  });
}

const serverTask = async (title: string) =>
  (await adminRest(`tasks?title=eq.${encodeURIComponent(title)}&select=id,status,folder_id`))[0];

test('sync: offline, fila, servidor e revogação', async ({ page, context }, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  await openSync(page);

  // Cria no banco local; a fila leva até o create_tasks_batch
  const title = `Sync ${testInfo.project.name} ${Date.now()}`;
  const field = page.getByPlaceholder('Nova tarefa na Caixa de entrada');
  await field.fill(title);
  await field.press('Enter');
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByText('0 alterações esperando envio')).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(async () => (await serverTask(title))?.status, { timeout: 20_000 })
    .toBe('todo');

  // Sem conexão: conclui no aparelho, fica na fila; volta a conexão e o complete_task roda
  await context.setOffline(true);
  await page.getByRole('checkbox', { name: title }).click();
  await expect(page.getByRole('checkbox', { name: title })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText(/^[1-9]\d* alterações esperando envio/)).toBeVisible();
  expect((await serverTask(title)).status).toBe('todo');
  await expect(page.getByText('Ação: complete_task')).toBeVisible();
  if (testInfo.project.name === 'desktop')
    await expect(
      page.getByRole('navigation').getByRole('link', { name: /^Sem conexão/ }),
    ).toBeVisible();
  await context.setOffline(false);
  await expect
    .poll(async () => (await serverTask(title))?.status, { timeout: 30_000 })
    .toBe('done');
  await expect(page.getByText('0 alterações esperando envio')).toBeVisible({ timeout: 15_000 });

  // Mudança feita no servidor chega sem recarregar
  const { id, folder_id } = await serverTask(title);
  await adminRest(`tasks?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title: `${title} (servidor)` }),
  });
  await expect(page.getByText(`${title} (servidor)`)).toBeVisible({ timeout: 15_000 });

  // Sem a participação na pasta, os dados dela somem do aparelho
  await adminRest(`folder_members?folder_id=eq.${folder_id}`, { method: 'DELETE' });
  await expect(page.getByText(`${title} (servidor)`)).toHaveCount(0, { timeout: 15_000 });
});

test('sync: reenvio depois de resposta perdida não duplica', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  await openSync(page);

  const title = `Recorrente ${testInfo.project.name} ${Date.now()}`;
  const field = page.getByPlaceholder('Nova tarefa na Caixa de entrada');
  await field.fill(title);
  await field.press('Enter');
  await expect
    .poll(async () => (await serverTask(title))?.status, { timeout: 20_000 })
    .toBe('todo');
  const { id } = await serverTask(title);
  await adminRest(`tasks?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ due_date: '2026-10-15', recurrence: { type: 'monthly' } }),
  });

  // A primeira chamada chega ao servidor, mas a resposta não volta: o app vai reenviar
  let lost = false;
  await page.route('**/rest/v1/rpc/run_once', async (route) => {
    if (lost) return route.continue();
    lost = true;
    await route.fetch();
    await route.abort('connectionreset');
  });
  await page.getByRole('checkbox', { name: title }).click();
  await expect.poll(() => lost).toBe(true);
  await expect
    .poll(async () => (await adminRest(`tasks?id=eq.${id}&select=due_date`))[0].due_date)
    .toBe('2026-11-15');
  await expect(page.getByText('0 alterações esperando envio')).toBeVisible({ timeout: 30_000 });

  const [task] = await adminRest(`tasks?id=eq.${id}&select=due_date`);
  expect(task.due_date).toBe('2026-11-15');
  const completions = await adminRest(`task_completions?task_id=eq.${id}&select=id`);
  expect(completions).toHaveLength(1);
});

test('sync: dois aparelhos offline na mesma tarefa chegam ao mesmo estado', async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const email = await signUp(page, testInfo);
  await openSync(page);
  const title = `Conflito ${testInfo.project.name} ${Date.now()}`;
  const field = page.getByPlaceholder('Nova tarefa na Caixa de entrada');
  await field.fill(title);
  await field.press('Enter');
  await expect
    .poll(async () => (await serverTask(title))?.status, { timeout: 20_000 })
    .toBe('todo');
  const { id } = await serverTask(title);

  // O mesmo usuário em outro "aparelho"
  const other = await browser.newContext({ ...testInfo.project.use, locale: 'pt-BR' });
  const b = await other.newPage();
  await b.goto('/');
  await b.getByPlaceholder('E-mail').fill(email);
  await b.getByPlaceholder('Senha').fill('senha-forte-123');
  await b.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(b.getByRole('heading', { name: /^Olá/ })).toBeVisible();
  await b.goto('/sync');
  await expect(b.getByText(title)).toBeVisible({ timeout: 20_000 });

  const run = (p: typeof page, sql: string, params: unknown[]) =>
    p.evaluate(([q, args]) => (window as any).questlistDb.execute(q, args), [sql, params] as const);
  const row = (p: typeof page) =>
    p.evaluate(
      (taskId) =>
        (window as any).questlistDb.get(
          'select title, priority, notes, labels from tasks where id = ?',
          [taskId],
        ),
      id,
    );
  const pending = (p: typeof page) =>
    p.evaluate(() => (window as any).questlistDb.get('select count(*) as n from ps_crud'));

  // Os dois sem rede, cada um mexendo em campos diferentes e nos mesmos (notas, etiquetas)
  await page.context().setOffline(true);
  await other.setOffline(true);
  await run(page, 'update tasks set title = ?, notes = ?, labels = ? where id = ?', [
    `${title} A`,
    'nota do A',
    '["casa"]',
    id,
  ]);
  await run(b, 'update tasks set priority = ?, notes = ?, labels = ? where id = ?', [
    3,
    'nota do B',
    '["urgente"]',
    id,
  ]);

  // A volta primeiro, depois B
  await page.context().setOffline(false);
  await expect.poll(async () => (await pending(page)).n, { timeout: 30_000 }).toBe(0);
  await other.setOffline(false);
  await expect.poll(async () => (await pending(b)).n, { timeout: 30_000 }).toBe(0);

  const expected = {
    title: `${title} A`,
    priority: 3,
    notes: 'nota do B',
    labels: '["casa","urgente"]',
  };
  await expect.poll(() => row(page), { timeout: 20_000 }).toEqual(expected);
  await expect.poll(() => row(b), { timeout: 20_000 }).toEqual(expected);

  // A nota do A perdeu, mas ficou guardada
  const copies = await adminRest(`conflict_copies?task_id=eq.${id}&select=body`);
  expect(copies).toEqual([{ body: 'nota do A' }]);
  await page.goto(`/task/${id}`);
  await page.getByRole('button', { name: 'Ver versão anterior' }).click();
  await expect(page.getByText('nota do A')).toBeVisible();
  await page.getByRole('button', { name: 'Descartar' }).click();
  await expect(page.getByRole('button', { name: 'Ver versão anterior' })).toHaveCount(0);
  await other.close();
});

test('sync: descartar mudanças locais', async ({ page, context }, testInfo) => {
  await signUp(page, testInfo);
  await openSync(page);
  await context.setOffline(true);
  const title = `Descartada ${testInfo.project.name} ${Date.now()}`;
  const field = page.getByPlaceholder('Nova tarefa na Caixa de entrada');
  await field.fill(title);
  await field.press('Enter');
  await expect(page.getByText('Tarefa: criar')).toBeVisible();

  await page.getByRole('button', { name: 'Descartar mudanças locais' }).click();
  await page.getByRole('button', { name: 'Descartar', exact: true }).click();
  await expect(page.getByText(title)).toHaveCount(0);
  await expect(page.getByText('Nada esperando envio.')).toBeVisible();
  await context.setOffline(false);
  await openSync(page);
  expect(await serverTask(title)).toBeUndefined();
});

test('sync: XP pendente offline, trocado pelo oficial ao voltar', async ({
  page,
  context,
}, testInfo) => {
  await signUp(page, testInfo);
  await openSync(page);
  await page.goto('/inbox');
  const title = `Pendente ${testInfo.project.name} ${Date.now()}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(title);
  await input.press('Enter');
  await expect
    .poll(async () => (await serverTask(title))?.status, { timeout: 20_000 })
    .toBe('todo');
  await ageTask(title);

  await context.setOffline(true);
  await page.getByRole('checkbox', { name: `Concluir ${title}` }).click();
  await expect(shown(page, /\+~10 XP \(pendente\)/)).toBeVisible({ timeout: 10_000 });
  if (testInfo.project.name === 'desktop')
    await expect(page.getByRole('navigation').getByText('+10 XP pendente')).toBeVisible();

  await context.setOffline(false);
  await expect
    .poll(async () => (await serverTask(title))?.status, { timeout: 30_000 })
    .toBe('done');
  await expect(page.getByText('+10 XP pendente')).toHaveCount(0, { timeout: 15_000 });
  if (testInfo.project.name === 'desktop')
    await expect(page.getByRole('navigation').getByText(/^10\/\d+ XP$/)).toBeVisible();
});

test('sync: criar, editar e apagar sem conexão, depois sincronizar', async ({
  page,
  context,
}, testInfo) => {
  await signUp(page, testInfo);
  await openSync(page);
  await context.setOffline(true);
  const title = `Efêmera ${testInfo.project.name} ${Date.now()}`;
  const field = page.getByPlaceholder('Nova tarefa na Caixa de entrada');
  await field.fill(title);
  await field.press('Enter');
  await expect(page.getByText(title)).toBeVisible();
  const local = (sql: string, params: unknown[] = []) =>
    page.evaluate(([q, args]) => (window as any).questlistDb.execute(q, args), [
      sql,
      params,
    ] as const);
  await local('update tasks set title = ?, priority = 2 where title = ?', [
    `${title} editada`,
    title,
  ]);
  await expect(page.getByText(`${title} editada`)).toBeVisible();
  await local('delete from tasks where title = ?', [`${title} editada`]);
  await expect(page.getByText(`${title} editada`)).toHaveCount(0);

  await context.setOffline(false);
  await expect(page.getByText('Nada esperando envio.')).toBeVisible({ timeout: 30_000 });
  expect(await serverTask(title)).toBeUndefined();
  expect(await serverTask(`${title} editada`)).toBeUndefined();
});

test('sync: removido do projeto com mudanças na fila', async ({ browser, page }, testInfo) => {
  test.setTimeout(120_000);
  // Dono: pasta com uma tarefa
  await signUp(page, testInfo);
  await openSync(page);
  const folderName = `Projeto ${testInfo.project.name} ${Date.now()}`;
  const ownerId = (
    await page.evaluate(() => (window as any).questlistDb.get('select id from profiles'))
  ).id as string;
  const [folder] = await adminRest('folders', {
    method: 'POST',
    body: JSON.stringify({ name: folderName, owner_id: ownerId }),
  });
  const [pageRow] = await adminRest('pages', {
    method: 'POST',
    body: JSON.stringify({ name: 'Tarefas', folder_id: folder.id }),
  });
  const title = `Compartilhada ${Date.now()}`;
  await adminRest('tasks', {
    method: 'POST',
    body: JSON.stringify({ title, page_id: pageRow.id, created_by: ownerId }),
  });

  // Membro, em outro "aparelho"
  const other = await browser.newContext({ ...testInfo.project.use, locale: 'pt-BR' });
  const member = await other.newPage();
  await signUp(member, testInfo);
  await openSync(member);
  const memberId = (
    await member.evaluate(() => (window as any).questlistDb.get('select id from profiles'))
  ).id as string;
  await adminRest('folder_members', {
    method: 'POST',
    body: JSON.stringify({ folder_id: folder.id, user_id: memberId, role: 'editor' }),
  });
  await expect(member.getByText(title)).toBeVisible({ timeout: 20_000 });

  // Sem conexão, o membro edita; enquanto isso, o dono o tira do projeto
  await other.setOffline(true);
  await member.evaluate(
    ([t]) =>
      (window as any).questlistDb.execute('update tasks set title = ? where title = ?', [
        `${t} (membro)`,
        t,
      ]),
    [title],
  );
  await adminRest(`folder_members?folder_id=eq.${folder.id}&user_id=eq.${memberId}`, {
    method: 'DELETE',
  });
  await other.setOffline(false);

  // A edição é recusada, a fila esvazia e os dados do projeto saem do aparelho
  await expect(member.getByText('Nada esperando envio.')).toBeVisible({ timeout: 30_000 });
  await expect(member.getByText(title, { exact: false })).toHaveCount(0, { timeout: 20_000 });
  expect((await adminRest(`tasks?page_id=eq.${pageRow.id}&select=title`))[0].title).toBe(title);
  await other.close();
});
