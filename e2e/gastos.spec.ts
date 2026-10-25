import { readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { adminRest, createPage, shown, signUp } from './helpers';

// ESCOPO_V9: página de gastos (lançar, editar, orçamento, exportar CSV/XLSX), foto da nota e foto
// de uma lista. A leitura usa o leitor de exemplo do servidor local (PHOTO_READER=fake em
// supabase/functions/.env): sempre "Mercado Exemplo", R$ 87,90, três itens e a mesma chave NFC-e.

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAMUlEQVR4nGM4sWUBTRHDqAWjQTSaikbzwWhRMVqajtYHo1XmaKtitF002nTcMkTyAQCrlnB5LR3fAgAAAABJRU5ErkJggg==',
  'base64',
);

const stat = (page: Page, label: string) => page.getByLabel(new RegExp(`^${label}: `));

async function choosePhoto(page: Page, button: string, count = 1) {
  await page.getByRole('button', { name: button }).first().click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Escolher da galeria' }).click();
  await (
    await chooser
  ).setFiles(
    Array.from({ length: count }, (_, i) => ({
      name: `nota${i}.png`,
      mimeType: 'image/png',
      buffer: PNG,
    })),
  );
}

test('gastos: lançar, editar, orçamento e exportar', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Reforma', name: 'Custos', type: 'Gastos' });

  // Lançamento rápido: descrição, valor, categoria; Enter no valor lança
  await page.getByRole('textbox', { name: 'Descrição' }).fill('Cimento');
  await page.getByRole('textbox', { name: 'Valor' }).fill('45,90');
  await page.getByRole('radio', { name: 'Material' }).click();
  await page.getByRole('textbox', { name: 'Valor' }).press('Enter');
  await expect(page.getByRole('button', { name: /^Cimento, −R\$\s45,90, Hoje$/ })).toBeVisible();
  await expect(stat(page, 'Gasto')).toHaveAttribute('aria-label', /R\$\s45,90/);

  // Entrada; a categoria fica escolhida entre lançamentos (para lançar várias seguidas): tira
  await page.getByRole('radio', { name: 'Entrada' }).click();
  await page.getByRole('radio', { name: 'Material' }).click();
  await page.getByRole('textbox', { name: 'Descrição' }).fill('Reembolso');
  await page.getByRole('textbox', { name: 'Valor' }).fill('10');
  await page.getByRole('button', { name: 'Lançar' }).click();
  await expect(stat(page, 'Saldo')).toHaveAttribute('aria-label', /-R\$\s35,90/);

  // Abrir o lançamento, mudar o valor; fechar salva
  await page.getByRole('button', { name: /^Cimento, / }).click();
  const amount = page.getByRole('textbox', { name: 'Valor' }).last();
  await expect(amount).toHaveValue('45,90');
  await amount.fill('50');
  await page.getByRole('button', { name: 'Fechar' }).last().click();
  await expect(stat(page, 'Gasto')).toHaveAttribute('aria-label', /R\$\s50,00/);

  // Orçamento
  await page.getByRole('button', { name: 'Definir orçamento' }).click();
  await page.getByPlaceholder('5000,00').fill('100');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(shown(page, /R\$\s50,00 de R\$\s100,00/)).toBeVisible();

  // Exportar CSV (ponto e vírgula, vírgula decimal) e XLSX (zip)
  await page.getByRole('button', { name: 'Exportar' }).click();
  let download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Planilha CSV' }).click();
  const csv = readFileSync(await (await download).path(), 'utf8');
  expect(csv).toContain('Data;Descrição;Categoria;Tipo;Valor');
  expect(csv).toMatch(/\d{4}-\d{2}-\d{2};Cimento;Material;Saída;50,00;BRL/);
  expect(csv).toMatch(/Reembolso;;Entrada;10,00;BRL/);

  await page.getByRole('button', { name: 'Exportar' }).click();
  download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Planilha do Excel (XLSX)' }).click();
  const xlsx = await download;
  expect(xlsx.suggestedFilename()).toMatch(/^Custos-\d{4}-\d{2}-\d{2}\.xlsx$/);
  expect(
    readFileSync(await xlsx.path())
      .subarray(0, 2)
      .toString(),
  ).toBe('PK');
});

test('abas Gastos e Entradas: cada uma só com o seu tipo, lançamento da aba e lembrada (D255)', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Casa', name: 'Contas', type: 'Gastos' });
  const cimento = page.getByRole('button', { name: /^Cimento, / });
  const reembolso = page.getByRole('button', { name: /^Reembolso, / });

  await page.getByRole('textbox', { name: 'Descrição' }).fill('Cimento');
  await page.getByRole('textbox', { name: 'Valor' }).fill('45,90');
  await page.getByRole('button', { name: 'Lançar' }).click();
  await page.getByRole('radio', { name: 'Entrada' }).click();
  await page.getByRole('textbox', { name: 'Descrição' }).fill('Reembolso');
  await page.getByRole('textbox', { name: 'Valor' }).fill('10');
  await page.getByRole('button', { name: 'Lançar' }).click();
  await expect(reembolso).toBeVisible();
  await expect(cimento).toBeVisible();

  // Entradas: só a entrada; lança sem escolher Saída/Entrada
  await page.getByRole('tab', { name: 'Entradas' }).click();
  await expect(reembolso).toBeVisible();
  await expect(cimento).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Saída' })).toHaveCount(0);
  await expect(stat(page, 'Entradas')).toHaveAttribute('aria-label', /R\$\s10,00/);
  await expect(stat(page, 'Gasto')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Descrição' }).fill('Venda da sobra');
  await page.getByRole('textbox', { name: 'Valor' }).fill('20');
  await page.getByRole('button', { name: 'Lançar' }).click();
  await expect(
    page.getByRole('button', { name: /^Venda da sobra, \+R\$\s20,00, Hoje$/ }),
  ).toBeVisible();

  // Gastos: só a saída, e a aba volta depois de recarregar
  await page.getByRole('tab', { name: 'Gastos' }).click();
  await expect(cimento).toBeVisible();
  await expect(reembolso).toHaveCount(0);
  await expect(stat(page, 'Gasto')).toHaveAttribute('aria-label', /R\$\s45,90/);
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Gastos' })).toHaveAttribute('aria-selected', 'true');
  await expect(cimento).toBeVisible();
  await expect(reembolso).toHaveCount(0);

  // Geral: tudo e o saldo
  await page.getByRole('tab', { name: 'Geral' }).click();
  await expect(stat(page, 'Saldo')).toHaveAttribute('aria-label', /-R\$\s15,90/);
});

test('foto da nota: lê, confere, salva com a foto e não lança a mesma nota duas vezes', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  const pageId = await createPage(page, { folder: 'Casa', name: 'Mercado', type: 'Gastos' });

  await choosePhoto(page, 'Foto da nota');
  await expect(page.getByText('Confira a nota')).toBeVisible({ timeout: 20_000 });
  const dialog = page.getByRole('dialog').or(page.locator('body'));
  await expect(dialog.getByRole('textbox', { name: 'Descrição' }).last()).toHaveValue(
    'Mercado Exemplo',
  );
  await expect(dialog.getByRole('textbox', { name: 'Valor' }).last()).toHaveValue('87,90');
  await expect(page.getByRole('radio', { name: 'Alimentação' }).last()).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('button', { name: /^Mercado Exemplo, −R\$\s87,90/ })).toBeVisible();

  // No servidor: a chave da NFC-e, os itens e a foto da nota
  await expect
    .poll(
      async () => {
        const [row] = await adminRest(
          `expenses?page_id=eq.${pageId}&select=nfce_key,receipt_path,items,method`,
        );
        return row && { ...row, receipt_path: !!row.receipt_path, items: row.items?.length };
      },
      { timeout: 20_000 },
    )
    .toEqual({
      nfce_key: '35261012345678000190650010000123451000123456',
      receipt_path: true,
      items: 3,
      method: 'pix',
    });

  // A mesma nota de novo: avisa
  await choosePhoto(page, 'Foto da nota');
  await expect(page.getByText(/Esta nota já foi lançada/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Descartar' }).click();
  await expect(page.getByRole('button', { name: /^Mercado Exemplo, / })).toHaveCount(1);
});

test('foto de uma lista vira tarefas', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Coisas', name: 'A fazer', type: 'Lista' });
  await page.getByRole('button', { name: 'Adicionar várias' }).click();
  await choosePhoto(page, 'Foto de uma lista');
  await expect(page.getByRole('textbox', { name: 'Lista de tarefas' })).toHaveValue(
    'Supino 3x10 40kg\nAgachamento 4x8\nComprar luvas amanhã',
    { timeout: 20_000 },
  );
  await page.getByRole('button', { name: 'Criar 3' }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Concluir Comprar luvas', exact: true }),
  ).toBeVisible();
});

test('duas notas: a conferência não recomeça, mostra a anterior salva e a de outro mês aparece', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Feira', name: 'Notas', type: 'Gastos' });

  await choosePhoto(page, 'Foto da nota', 2);
  await expect(page.getByText('Confira a nota')).toBeVisible({ timeout: 20_000 });
  const description = page.getByRole('textbox', { name: 'Descrição' }).last();
  await description.fill('Primeira nota');
  await page.getByRole('textbox', { name: 'Data' }).last().fill('11/09/2024');
  // A segunda termina de ser lida com a primeira aberta: o que foi digitado fica
  await expect(page.getByText('Lendo a nota…')).toBeHidden({ timeout: 20_000 });
  await expect(page.getByText('Depois desta, mais 1 nota.')).toBeVisible();
  await expect(description).toHaveValue('Primeira nota');
  await page.getByRole('button', { name: 'Salvar' }).click();

  // A segunda diz que a primeira foi salva
  await expect(page.getByText('✓ Salvo: Primeira nota. Agora a próxima nota.')).toBeVisible();
  await expect(page.getByText(/Esta nota já foi lançada/)).toBeVisible();
  await page.getByRole('button', { name: 'Descartar' }).click();

  // De outro mês: a lista passa para "Tudo" e o lançamento aparece
  await expect(page.getByRole('radio', { name: 'Tudo' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: /^Primeira nota, −R\$\s87,90/ })).toBeVisible();
});

// CD30: a tela de gastos rola inteira (com 4 lançamentos e uma categoria o fim ficava cortado no
// celular, sem rolagem)
test('gastos: a tela rola até o último lançamento', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Casa', name: 'Contas', type: 'Gastos' });
  const items = ['Luz', 'Água', 'Internet', 'Gás', 'Condomínio', 'Mercado'];
  for (const [i, name] of items.entries()) {
    await page.getByRole('textbox', { name: 'Descrição' }).fill(name);
    await page.getByRole('textbox', { name: 'Valor' }).fill(String(100 + i));
    if (i === 0) await page.getByRole('radio', { name: 'Material' }).click();
    await page.getByRole('textbox', { name: 'Valor' }).press('Enter');
    await expect(page.getByRole('button', { name: new RegExp(`^${name}, `) })).toBeVisible();
  }
  // Rolar como a pessoa rola (roda do mouse / dedo): sem a rolagem da tela, nada se mexia e o
  // fim ficava cortado (o scrollIntoView do Playwright rola por fora e não pegava o problema)
  const last = page.getByRole('button', { name: /^Mercado, / });
  await expect(async () => {
    await page.mouse.move(200, 400);
    await page.mouse.wheel(0, 2000);
    await expect(last).toBeInViewport({ timeout: 1000 });
  }).toPass({ timeout: 10_000 });
});
