import { expect, test } from '@playwright/test';

import { adminRest, openTab, signUp } from './helpers';

// Correção: título longo num vínculo empurrava o X de remover para fora da tela.
test('Relacionados: título longo não esconde o X de tirar o vínculo', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  const id = `${testInfo.project.name}${Date.now()}`;
  const long = `Revisar o contrato do fornecedor de material de construção com todas as cláusulas ${id}`;
  const short = `Ligar ${id}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  for (const title of [long, short]) {
    await input.fill(title);
    await input.press('Enter');
    await expect(page.getByRole('button', { name: `Detalhes de ${title}` })).toBeVisible();
  }

  // A busca de Relacionar é no servidor: espera a tarefa longa subir do aparelho
  await expect
    .poll(
      async () =>
        ((await adminRest(`tasks?select=id&title=eq.${encodeURIComponent(long)}`)) as unknown[])
          .length,
      { timeout: 20_000 },
    )
    .toBe(1);
  await page.getByRole('button', { name: `Detalhes de ${short}` }).click();
  await page.getByRole('button', { name: 'Relacionar', exact: true }).click();
  await page.getByRole('textbox', { name: 'Buscar tarefa, lista ou projeto…' }).fill('contrato');
  // W5: o nome do resultado aparece (antes, o contexto ao lado espremia o nome até sumir)
  await expect(page.getByRole('button', { name: `Relacionar com tarefa ${long}` })).toBeVisible({
    timeout: 15_000,
  });
  await page.screenshot({ path: testInfo.outputPath('busca.png') });
  await page.getByRole('button', { name: `Relacionar com tarefa ${long}` }).click();
  await expect(page.getByRole('link', { name: `Abrir tarefa ${long}` })).toBeVisible();

  const unlink = page.getByRole('button', { name: `Tirar o vínculo com ${long}` });
  await expect(unlink).toBeInViewport({ ratio: 1 });
  await unlink.click();
  await expect(page.getByRole('link', { name: `Abrir tarefa ${long}` })).toHaveCount(0);
});
