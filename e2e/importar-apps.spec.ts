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
  await expect(page.getByRole('heading', { name: 'Habitica' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: `Casa ${stamp}` })).toBeVisible();
  await page
    .getByRole('link', { name: /^Mercado/ })
    .last()
    .click();
  await expect(page.getByText(`Pão ${stamp}`)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('ter, 1 dez')).toBeVisible();
  await page.getByRole('button', { name: `Abrir subtarefas de Pão ${stamp}` }).click();
  await expect(page.getByText(`Fermento ${stamp}`)).toBeVisible();
});
