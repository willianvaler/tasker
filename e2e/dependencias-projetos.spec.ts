import { expect, test, type Page } from '@playwright/test';

import { openTab, shown, signUp, waitForSync } from './helpers';

// PC2 (V3 §6 C, D307): uma etapa da Reforma espera o Carvão do Churrasco, que é outro projeto.
// A busca do "Depende de" mostra as tarefas dos outros projetos com o nome deles.
async function fromTemplate(page: Page, button: string, name: string) {
  await openTab(page, 'Pastas');
  await page.getByRole('button', { name: 'Usar modelo' }).click();
  await page.getByRole('button', { name: button }).click();
  await page.getByPlaceholder('Nome').fill(name);
  const created = page.waitForResponse(
    (r) => r.url().includes('/rpc/create_from_template') && r.ok(),
  );
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await created;
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

test('dependência entre projetos', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'o painel é o mesmo no celular');
  test.setTimeout(90_000);
  const stamp = Date.now();
  const churrasco = `Churrasco ${stamp}`;
  const reforma = `Reforma ${stamp}`;
  const step = 'Definir o que vai ser feito';
  await signUp(page, testInfo);
  await fromTemplate(page, 'Modelo Churrasco', churrasco);
  await fromTemplate(page, 'Kit Reforma', reforma);

  await page
    .getByRole('link', { name: /^Etapas/ })
    .last()
    .click();
  await page.getByRole('button', { name: `Detalhes de ${step}` }).click();
  await page.getByPlaceholder('Buscar tarefa… (ao criar: ^nome)').fill('carv');
  await page.getByRole('button', { name: `Depender de Carvão (${churrasco})` }).click();
  await expect(shown(page, `Aguardando: Carvão (${churrasco})`)).toBeVisible({ timeout: 15_000 });
  const panel = page.url();

  // Feito no Churrasco, a etapa da Reforma fica pronta
  await openTab(page, 'Pastas');
  await page.getByRole('link', { name: churrasco }).first().click();
  await page
    .getByRole('link', { name: /^Compras/ })
    .last()
    .click();
  await page.getByRole('checkbox', { name: 'Concluir Carvão' }).click();
  await waitForSync(page);
  await page.goto(panel);
  await expect(page.getByRole('button', { name: `Opções de Carvão (${churrasco})` })).toBeVisible({
    timeout: 15_000,
  });
  await expect(shown(page, `Aguardando: Carvão (${churrasco})`)).toHaveCount(0, {
    timeout: 15_000,
  });
});
