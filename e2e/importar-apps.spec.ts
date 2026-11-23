import { expect, test } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';

import { openSettings, signUp } from './helpers';

// PC1 (V3 §6 C, D306): importar o JSON do Habitica e o backup do Todoist (.zip de CSVs). Cada
// origem vira um projeto pessoal, conferido antes de criar.
test('importar do Habitica e do Todoist', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'o fluxo é o mesmo no celular');
  const stamp = Date.now();
  await signUp(page, testInfo);

  const habitica = {
    tags: [{ id: 't1', name: 'Saúde' }],
    tasks: {
      habits: [{ text: `Beber água ${stamp}`, up: true, down: false, tags: ['t1'] }],
      dailys: [{ text: `Alongar ${stamp}`, frequency: 'daily', everyX: 1 }],
      todos: [
        {
          text: `Relatório ${stamp}`,
          checklist: [{ text: `Introdução ${stamp}`, completed: false }],
        },
        { text: 'Antigo', completed: true },
      ],
      rewards: [{ text: 'Pizza' }],
    },
  };
  async function choose(name: string, mimeType: string, buffer: Buffer) {
    await openSettings(page);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Importar do Habitica ou do Todoist' }).click();
    await (await chooser).setFiles({ name, mimeType, buffer });
  }

  await choose(
    'habitica-user-data.json',
    'application/json',
    Buffer.from(JSON.stringify(habitica)),
  );
  await expect(page.getByText('Importar 4 tarefas?')).toBeVisible();
  await expect(page.getByText(/1 item já concluído fica de fora/)).toBeVisible();
  await expect(page.getByText(/1 recompensa fica de fora/)).toBeVisible();
  let created = page.waitForResponse(
    (r) => r.url().includes('/rpc/create_from_template') && r.ok(),
  );
  await page.getByRole('button', { name: 'Importar', exact: true }).click();
  await created;
  await expect(page.getByRole('heading', { name: 'Habitica' })).toBeVisible({ timeout: 20_000 });
  await page
    .getByRole('link', { name: /^Afazeres/ })
    .last()
    .click();
  await expect(page.getByText(`Relatório ${stamp}`)).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Voltar' }).click();
  await page
    .getByRole('link', { name: /^Hábitos/ })
    .last()
    .click();
  await expect(page.getByText(`Beber água ${stamp}`).first()).toBeVisible({ timeout: 15_000 });

  const csv = [
    'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE',
    `task,Ligar ${stamp} @casa,,1,1,Ana,,,,`,
    'section,Mercado,,,,,,,,',
    `task,Pão ${stamp},Integral,4,1,Ana,,2026-12-01,pt,`,
    `task,Fermento ${stamp},,4,2,Ana,,,,`,
  ].join('\n');
  const zip = zipSync({ [`Casa ${stamp} [123].csv`]: strToU8(csv) });
  await choose('todoist-backup.zip', 'application/zip', Buffer.from(zip));
  await expect(page.getByText('Importar 3 tarefas?')).toBeVisible();
  await expect(page.getByText(new RegExp(`Vira o projeto pessoal Casa ${stamp}`))).toBeVisible();
  created = page.waitForResponse((r) => r.url().includes('/rpc/create_from_template') && r.ok());
  await page.getByRole('button', { name: 'Importar', exact: true }).click();
  await created;
  // A pasta nova chega na árvore um pouco depois de criada
  await expect(page.getByRole('heading', { name: `Casa ${stamp}` })).toBeVisible({
    timeout: 20_000,
  });
  await page
    .getByRole('link', { name: /^Mercado/ })
    .last()
    .click();
  await expect(page.getByText(`Pão ${stamp}`)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('ter, 1 dez')).toBeVisible();
  await page.getByRole('button', { name: `Abrir subtarefas de Pão ${stamp}` }).click();
  await expect(page.getByText(`Fermento ${stamp}`)).toBeVisible();
});

// ES8 (ESCOPO_V13 §6, D330): o .zip do plano de estudos (dois CSVs e a pasta do material). O material
// vai para o projeto que casa com os códigos, que nasce plano de estudos, com o material ligado.
test('importar o plano de estudos inteiro (CSV + material)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'o fluxo é o mesmo no celular');
  test.setTimeout(120_000);
  const stamp = Date.now();
  await signUp(page, testInfo);
  const head =
    'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE';
  const plan = [
    head,
    'section,Fase 0 · Começo,,,,,,,,',
    'task,Leia primeiro,,4,1,,,,,',
    'section,Fase 1A · Alavancas,,,,,,,,',
    'task,M01 · Balança de régua,,4,1,,,,,',
    'task,S1 · Montar a régua,,4,2,,,,,',
  ].join('\n');
  const other = [head, 'task,P01 · Ponte de palitos,,4,1,,,,,'].join('\n');
  const PDF = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF`;
  const zip = zipSync({
    [`plano/Engenharia ${stamp}.csv`]: strToU8(plan),
    [`plano/Pontes ${stamp}.csv`]: strToU8(other),
    'plano/material/01 - Fase 0 - Prelúdio.md': strToU8('# Prelúdio\n\nComeçar pelo equilíbrio.'),
    'plano/material/03 - M01 - Assis.pdf': strToU8(PDF),
    'plano/material/LEIA-ME.md': strToU8('# Material'),
    'plano/material/.obsidian/app.json': strToU8('{}'),
  });
  await openSettings(page);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar do Habitica ou do Todoist' }).click();
  await (
    await chooser
  ).setFiles({ name: 'plano.zip', mimeType: 'application/zip', buffer: Buffer.from(zip) });
  await expect(page.getByText('Importar 4 tarefas?')).toBeVisible();
  await expect(
    page.getByText(
      new RegExp(
        `Material: 3 itens \\(.+\\) para Engenharia ${stamp}: 2 ligados às tarefas pelo código, 1 sem tarefa`,
      ),
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Importar', exact: true }).click();
  await expect(page.getByText(/3 materiais adicionados/)).toBeVisible({ timeout: 60_000 });

  // Abre o projeto do material, já plano de estudos, com o que estudar agora e o material ligado
  await expect(page.getByRole('heading', { name: `Engenharia ${stamp}` })).toBeVisible({
    timeout: 20_000,
  });
  const card = page.getByTestId('study-now');
  await expect(card.getByText('Leia primeiro')).toBeVisible();
  await expect(card.getByText('01 - Fase 0 - Prelúdio')).toBeVisible();
  await expect(page.getByTestId('materials').getByRole('link')).toHaveText([
    /01 - Fase 0 - Prelúdio/,
    /03 - M01 - Assis/,
    /LEIA-ME/,
  ]);
});
