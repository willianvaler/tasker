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

async function choosePhoto(page: Page, button: string) {
  await page.getByRole('button', { name: button }).first().click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Escolher da galeria' }).click();
  await (await chooser).setFiles({ name: 'nota.png', mimeType: 'image/png', buffer: PNG });
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
  await expect(page.getByRole('checkbox', { name: 'Concluir Comprar luvas', exact: true })).toBeVisible();
});
