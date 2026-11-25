import { expect, test, type Page } from '@playwright/test';

import { adminRest, createPage, signUp } from './helpers';

const userIdOf = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    return JSON.parse(localStorage.getItem(key ?? '') ?? '{}').user?.id as string;
  });

// ESCOPO_V14 (AU3): cada gatilho que já tem de onde nascer dispara a regra pessoal, o executor
// (Edge Function automation-run, chamada pelo banco) roda e o aviso aparece no 🔔 com o texto
// expandido. Precisa do executor ligado no Supabase local (`app_config.automation_url`, D334).
// O editor das regras é do AU7: aqui elas entram direto no banco.
test('gatilhos do motor: tarefa, lista, atribuição, nível, boss e marco avisam', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'o motor é do servidor: basta um perfil');
  test.setTimeout(120_000);
  await signUp(page, testInfo);
  const uid = await userIdOf(page);
  const pageId = await createPage(page, {
    folder: `Casa ${Date.now()}`,
    name: 'Semana',
    type: 'Lista',
  });
  const [{ folder_id: folderId }] = await adminRest(`pages?id=eq.${pageId}&select=folder_id`);
  // Marco só existe em projeto
  await adminRest(`folders?id=eq.${folderId}`, {
    method: 'PATCH',
    body: JSON.stringify({ kind: 'project' }),
  });

  const regras: [string, string][] = [
    ['tarefa.criada', 'Criada: {{evento.titulo|corta:12}}{{evento.inexistente}}'],
    ['tarefa.concluida', 'Concluída: {{event.title}}'],
    ['tarefa.pronta', 'Pode começar: {{evento.titulo}}'],
    ['tarefa.atribuida', 'Comigo: {{evento.titulo}}'],
    ['lista.concluida', 'Lista {{evento.lista_nome}} fechada'],
    ['nivel.subiu', 'Nível {{evento.nivel}}'],
    ['boss.derrotado', 'Venceu {{evento.boss_nome}}'],
    ['marco.atingido', 'Marco {{evento.marco_nome|padrao:"?"}}'],
  ];
  await adminRest('automation_rules', {
    method: 'POST',
    body: JSON.stringify(
      regras.map(([tipo, corpo]) => ({
        scope: 'pessoal',
        owner_id: uid,
        name: tipo,
        definition: {
          v: 1,
          gatilho: { tipo },
          passos: [{ tipo: 'notificar', corpo, canal: 'app' }],
        },
      })),
    ),
  });

  // Duas tarefas pela tela; a segunda depende da primeira e a primeira é minha
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  for (const title of ['Lavar o carro da família', 'Secar o carro']) {
    const saved = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
    await input.fill(title);
    await input.press('Enter');
    await saved;
  }
  const tasks: { id: string; title: string }[] = await adminRest(
    `tasks?page_id=eq.${pageId}&select=id,title`,
  );
  const lavar = tasks.find((t) => t.title.startsWith('Lavar'))!.id;
  const secar = tasks.find((t) => t.title.startsWith('Secar'))!.id;
  await adminRest('task_dependencies', {
    method: 'POST',
    body: JSON.stringify({ task_id: secar, depends_on_task_id: lavar, folder_id: folderId }),
  });
  await adminRest('task_assignees', {
    method: 'POST',
    body: JSON.stringify({ task_id: lavar, user_id: uid }),
  });

  // Concluir a primeira (concluída + a segunda fica pronta) e a segunda (a lista inteira)
  await page.reload();
  for (const title of ['Lavar o carro da família', 'Secar o carro']) {
    const done = page.waitForResponse((r) => r.url().includes('complete_task') && r.ok());
    await page.getByRole('checkbox', { name: `Concluir ${title}` }).click();
    await done;
  }

  // Jogo e marco: o motor só lê; aqui o banco muda direto
  const [{ level }] = await adminRest(`profiles?id=eq.${uid}&select=level`);
  await adminRest(`profiles?id=eq.${uid}`, {
    method: 'PATCH',
    body: JSON.stringify({ level: level + 1 }),
  });
  const now = new Date().toISOString();
  const [boss] = await adminRest('bosses', {
    method: 'POST',
    body: JSON.stringify({
      scope: 'user',
      scope_id: uid,
      name: 'Dragão do E2E',
      icon: 'x',
      period_key: `e2e-${Date.now()}`,
      max_hp: 10,
      hp: 0,
      starts_at: now,
      ends_at: new Date(Date.now() + 86_400_000).toISOString(),
    }),
  });
  await adminRest(`bosses?id=eq.${boss.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'defeated', defeated_at: now }),
  });
  const [marco] = await adminRest('milestones', {
    method: 'POST',
    body: JSON.stringify({ folder_id: folderId, name: 'Mudança', created_by: uid }),
  });
  await adminRest(`milestones?id=eq.${marco.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ done_at: now }),
  });

  // Cada gatilho virou um aviso (o executor roda segundos depois)
  await expect
    .poll(
      async () =>
        (await adminRest(`notifications?user_id=eq.${uid}&kind=eq.automation&select=id`)).length,
      { timeout: 30_000 },
    )
    .toBeGreaterThanOrEqual(10);

  await page.goto('/notifications');
  for (const text of [
    'Criada: Lavar o carr',
    'Criada: Secar o carr',
    'Concluída: Lavar o carro da família',
    'Pode começar: Secar o carro',
    'Comigo: Lavar o carro da família',
    'Lista Semana fechada',
    `Nível ${level + 1}`,
    'Venceu Dragão do E2E',
    'Marco Mudança',
  ]) {
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
  }

  // A variável que não existe virou vazio e ficou como aviso na execução
  const runs: { warnings: string[] }[] = await adminRest(
    `automation_runs?select=warnings,automation_rules!inner(owner_id,trigger_type)&automation_rules.owner_id=eq.${uid}&automation_rules.trigger_type=eq.tarefa.criada`,
  );
  expect(runs.flatMap((r) => r.warnings)).toContain('Variável inexistente: evento.inexistente');
});
