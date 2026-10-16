import { expect, test, type Page } from '@playwright/test';

import { adminRest, isRpc, openTab, signUp, waitForSync } from './helpers';

// Aceite da Fase I (V3 §2.6 e §2.7): as visões do projeto (Fluxo, Pessoas, Linha do tempo) e o
// histórico da tarefa.

const SHOTS = process.env.SHOTS_DIR;

async function churrasco(page: Page) {
  await openTab(page, 'Pastas');
  await page.getByRole('button', { name: 'Usar modelo' }).click();
  await page.getByRole('button', { name: 'Modelo Churrasco' }).click();
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Churrasco' })).toBeVisible();
  const project = page.url();
  // Três tarefas em sequência pelo lote (^ é o número do item)
  await page.getByRole('link', { name: 'Compras' }).last().click();
  await page.getByRole('button', { name: 'Adicionar várias' }).click();
  await page
    .getByRole('textbox', { name: 'Lista de tarefas' })
    .fill('Comprar carvão\nAcender o fogo ^1\nAssar a carne ^2');
  await page.getByRole('button', { name: 'Criar 3' }).click();
  await expect(page.getByText('Aguardando: Acender o fogo').last()).toBeVisible({
    timeout: 15_000,
  });
  const compras = page.url();
  await page.goto(project);
  await expect(page.getByRole('heading', { name: 'Churrasco' })).toBeVisible();
  return { project, compras };
}

test('Fluxo: grafo da esquerda para a direita, "você está aqui" e lista acessível', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  await churrasco(page);

  await page.getByRole('tab', { name: 'Fluxo' }).click();
  await expect(page).toHaveURL(/view=flow/);
  await expect(page.getByText('Você está aqui: 1 tarefa pronta para fazer')).toBeVisible();

  if (testInfo.project.name !== 'celular') {
    await expect(page.getByLabel(/^Comprar carvão · Pronta/)).toBeVisible();
    await expect(
      page.getByLabel(/^Assar a carne · Bloqueada · Aguardando: Acender o fogo/),
    ).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/fluxo-${testInfo.project.name}.png` });
    await page.getByRole('button', { name: 'Raias por pessoa' }).click();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/fluxo-raias.png` });
    // Clicar no nó abre a tarefa
    await page.getByLabel(/^Comprar carvão · Pronta/).click();
    await expect(page.getByRole('button', { name: 'Iniciar', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Voltar' }).click();
  }

  // A alternativa em lista: etapas em ordem
  await page.getByRole('button', { name: 'Ver em lista' }).click();
  await expect(page.getByText('Etapa 3')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Assar a carne · Bloqueada/ })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/fluxo-lista-${testInfo.project.name}.png` });
});

test('Pessoas: quem está fazendo o quê', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  await churrasco(page);

  // Na aba Lista, os indicadores: o carvão segura o fogo e a carne
  await expect(page.getByRole('button', { name: 'Comprar carvão segura 2 tarefas' })).toBeVisible();

  await page.getByRole('tab', { name: 'Pessoas' }).click();
  const loose = page.getByRole('group', { name: /^Sem responsável: \d+ abertas/ });
  await expect(loose).toBeVisible();
  await expect(
    loose.getByRole('button', { name: 'Comprar carvão · Pronta para fazer' }),
  ).toBeVisible();
  await expect(loose.getByRole('button', { name: 'Assar a carne · Esperando' })).toBeVisible();

  // Iniciar pelo painel: vai para "Fazendo agora"
  await loose.getByRole('button', { name: 'Comprar carvão · Pronta para fazer' }).click();
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(loose.getByRole('button', { name: 'Comprar carvão · Fazendo agora' })).toBeVisible({
    timeout: 15_000,
  });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/pessoas-${testInfo.project.name}.png` });
});

test('Linha do tempo e histórico da tarefa: quem fez o quê, filtros e CSV', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  const { project, compras } = await churrasco(page);

  // Concluir o carvão libera o fogo
  await page.goto(compras);
  await page.getByRole('checkbox', { name: 'Concluir Comprar carvão' }).click();
  await expect(page.getByText('Aguardando: Comprar carvão')).toHaveCount(0, { timeout: 15_000 });
  // O histórico é do servidor: espera a conclusão chegar lá (a fila vazia logo depois do toque
  // não garante isso)
  await waitForSync(page);
  const pageId = compras.split('/page/')[1]?.split(/[?#]/)[0];
  await expect
    .poll(
      async () =>
        (
          await adminRest(
            `tasks?page_id=eq.${pageId}&title=eq.${encodeURIComponent('Comprar carvão')}&select=status`,
          )
        )[0]?.status,
      { timeout: 20_000 },
    )
    .toBe('done');

  // No painel do fogo, o histórico conta a história
  await page.getByRole('button', { name: 'Detalhes de Acender o fogo' }).click();
  await page.getByRole('button', { name: 'Histórico de mudanças' }).click();
  const history = page.getByRole('list', { name: 'Histórico de mudanças' });
  await expect(history.getByText('Ficou pronta: "Comprar carvão" foi concluída')).toBeVisible();
  await expect(history.getByText('Passou a esperar "Comprar carvão"')).toBeVisible();
  await expect(history.getByText('Teste E2E ligou a "Comprar carvão"')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar' }).click();

  await page.goto(`${project}?view=timeline`);
  await expect(page.getByRole('tab', { name: 'Linha do tempo' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(
    page.getByRole('button', { name: 'Comprar carvão: Teste E2E concluiu' }),
  ).toBeVisible();

  // Filtro por tipo: só os bloqueios
  await page.getByRole('button', { name: 'Bloqueios' }).click();
  await expect(
    page.getByRole('button', {
      name: 'Acender o fogo: Ficou pronta: "Comprar carvão" foi concluída',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Comprar carvão: Teste E2E concluiu' }),
  ).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/linha-${testInfo.project.name}.png` });

  // CSV com o que está na tela
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('Churrasco - Linha do tempo.csv');
  let csv = '';
  for await (const chunk of await file.createReadStream()) csv += String(chunk);
  expect(csv).toContain('Ficou pronta');
});

test('lista que depende de outra: bloqueada até a anterior chegar ao percentual', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Igual nos dois perfis');
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  const { project } = await churrasco(page);

  // Uma lista nova com duas tarefas: Alvenaria
  await page.getByRole('button', { name: 'Nova lista' }).first().click();
  await page.getByPlaceholder('Nome (ex.: Treino A)').fill('Alvenaria');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { name: /Alvenaria$/ })).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Levantar parede');
  await input.press('Enter');
  await input.fill('Rebocar');
  await input.press('Enter');
  await expect(page.getByRole('checkbox', { name: 'Concluir Rebocar' })).toBeVisible();
  const alvenaria = page.url();
  // As tarefas aparecem antes de gravar (otimista): recarregar agora poderia perdê-las
  await waitForSync(page);

  // Organização libera depois da Alvenaria a 100%
  await page.goto(project);
  await page.getByRole('link', { name: 'Organização' }).last().click();
  await expect(page.getByRole('heading', { name: /Organização$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Configurar página' }).click();
  await page.getByRole('button', { name: /^\+ .*Alvenaria$/ }).click();
  await expect(page.getByRole('radio', { name: '100%' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Cancelar' }).click();

  await expect(
    page.getByText(/Esta lista espera ".*Alvenaria" chegar a 100% \(agora 0%\)/),
  ).toBeVisible();
  const first = page.getByRole('checkbox', { name: /^Concluir / }).first();
  await expect(first).toBeDisabled();
  await expect(page.getByText(/Aguardando: .*Alvenaria \(0% de 100%\)/).first()).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/lista-bloqueada.png` });

  // A 50%: uma das duas tarefas da Alvenaria basta
  await page.getByRole('button', { name: 'Configurar página' }).click();
  await page.getByRole('radio', { name: '50%' }).click();
  await expect(page.getByRole('radio', { name: '50%' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.goto(alvenaria);
  // Recarregar antes da conclusão subir a perderia: espera o servidor responder
  const completed = page.waitForResponse((r) => isRpc(r, 'complete_task'));
  await page.getByRole('checkbox', { name: 'Concluir Levantar parede' }).click();
  await completed;
  await expect(
    page.getByRole('alert').filter({ hasText: 'Concluída: Levantar parede' }),
  ).toBeVisible();
  await page.goto(project);
  await page.getByRole('link', { name: 'Organização' }).last().click();
  await expect(page.getByText(/Esta lista espera/)).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole('checkbox', { name: /^Concluir / }).first()).toBeEnabled();
});

test('Relacionados: ligar projeto e tarefa, e o vínculo aparece dos dois lados', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Igual nos dois perfis');
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  const { compras } = await churrasco(page);

  // No projeto: Relacionar → busca → escolhe a tarefa
  await page.getByRole('button', { name: 'Relacionar', exact: true }).click();
  await page.getByRole('textbox', { name: 'Buscar tarefa, lista ou projeto…' }).fill('carvão');
  await page.getByRole('button', { name: 'Relacionar com tarefa Comprar carvão' }).click();
  await expect(page.getByRole('link', { name: 'Abrir tarefa Comprar carvão' })).toBeVisible();

  // Na tarefa, o projeto aparece em Relacionados
  await page.goto(compras);
  await page.getByRole('button', { name: 'Detalhes de Comprar carvão' }).click();
  await expect(page.getByRole('link', { name: 'Abrir projeto Churrasco' })).toBeVisible();
  // E dá para tirar o vínculo
  await page.getByRole('button', { name: 'Tirar o vínculo com Churrasco' }).click();
  await expect(page.getByRole('link', { name: 'Abrir projeto Churrasco' })).toHaveCount(0);
});
