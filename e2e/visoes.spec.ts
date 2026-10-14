import { expect, test, type Page } from '@playwright/test';

import { openTab, signUp } from './helpers';

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
  await expect(page.getByText('Aguardando: Acender o fogo').last()).toBeVisible({ timeout: 15_000 });
  await page.goto(project);
  await expect(page.getByRole('heading', { name: 'Churrasco' })).toBeVisible();
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
    await expect(page.getByLabel(/^Assar a carne · Bloqueada · Aguardando: Acender o fogo/)).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/fluxo-${testInfo.project.name}.png` });
    await page.getByRole('button', { name: 'Raias por pessoa' }).click();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/fluxo-raias.png` });
    // Clicar no nó abre a tarefa
    await page.getByLabel(/^Comprar carvão · Pronta/).click();
    await expect(page.getByRole('button', { name: 'Iniciar' })).toBeVisible();
    await page.getByRole('button', { name: 'Voltar' }).click();
  }

  // A alternativa em lista: etapas em ordem
  await page.getByRole('button', { name: 'Ver em lista' }).click();
  await expect(page.getByText('Etapa 3')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Assar a carne · Bloqueada/ })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/fluxo-lista-${testInfo.project.name}.png` });
});
