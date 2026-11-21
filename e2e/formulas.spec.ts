import { expect, test } from '@playwright/test';

import { createPage, shown, signUp, waitForSync } from './helpers';

// Campo calculado e totais no rodapé (VS2, D318): a fórmula confere os nomes ao salvar, o valor
// aparece no painel e na tabela da visão, e o rodapé soma (tocar troca para média e fica salvo).

test('campo calculado e totais no rodapé da tabela', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Casa', name: 'Compras', type: 'Lista' });
  await page.getByRole('button', { name: 'Opções da lista' }).click();
  await shown(page, 'Campos da lista…').click();
  const name = page.getByRole('textbox', { name: 'Nome do campo' });
  await name.fill('Valor');
  await page.getByRole('radio', { name: 'Moeda' }).click();
  await page.getByRole('button', { name: 'Adicionar campo' }).click();
  await name.fill('Quantidade');
  await page.getByRole('radio', { name: 'Número' }).click();
  await page.getByRole('button', { name: 'Adicionar campo' }).click();
  await expect(page.getByRole('button', { name: 'Tirar o campo Quantidade' })).toBeVisible();

  // Calculado: nome que não existe é recusado antes de salvar
  await name.fill('Total');
  await page.getByRole('radio', { name: 'Calculado' }).click();
  const formula = page.getByRole('textbox', { name: 'Fórmula' });
  await formula.fill('{Nada} + 1');
  await expect(page.getByText('Não há campo "Nada" nesta lista.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adicionar campo' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await formula.fill('{Valor} * {Quantidade}');
  await page.getByRole('button', { name: 'Adicionar campo' }).click();
  await expect(page.getByRole('button', { name: 'Mudar a fórmula de Total' })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar' }).last().click();

  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  for (const [title, value, qty, total] of [
    ['Tinta', '10', '3', '30'],
    ['Piso', '5', '2', '10'],
  ]) {
    await input.fill(title);
    await input.press('Enter');
    await page.getByRole('button', { name: `Detalhes de ${title}` }).click();
    const v = page.getByRole('textbox', { name: 'Valor', exact: true });
    await v.fill(value);
    await v.blur();
    const q = page.getByRole('textbox', { name: 'Quantidade', exact: true });
    await q.fill(qty);
    await q.blur();
    // O calculado não se digita: aparece pronto
    await expect(page.getByLabel('Total', { exact: true })).toHaveText(total);
    await page.getByRole('button', { name: 'Voltar' }).click();
  }

  // Tabela com o calculado e o rodapé
  await page.getByRole('button', { name: 'Nova visão' }).click();
  await page.getByRole('textbox', { name: 'Nome da visão' }).fill('Planilha');
  await page.getByRole('radio', { name: 'Tabela' }).click();
  await page.getByRole('checkbox', { name: 'Valor' }).click();
  await page.getByRole('checkbox', { name: 'Total' }).click();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Total de Total: Soma 40' })).toBeVisible();
  await expect(page.getByRole('cell', { name: /^Total de Valor: Soma R\$\s15,00$/ })).toBeVisible();
  await page.getByRole('cell', { name: 'Total de Total: Soma 40' }).click();
  await expect(page.getByRole('cell', { name: 'Total de Total: Média 20' })).toBeVisible();

  // A troca do total fica na visão
  await waitForSync(page);
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByRole('cell', { name: 'Total de Total: Média 20' })).toBeVisible();
});
