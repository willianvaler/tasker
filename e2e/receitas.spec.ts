import { expect, test } from '@playwright/test';

import { adminRest, openTab, shown, signUp, waitForSync } from './helpers';

// SA5 (D391): receita é anotação com porções e ingredientes; os macros vêm da tabela da pessoa
// (o que falta aparece em "Sem dados"); juntar nas compras ajusta pelas porções e cai no lote.
test('receitas: macros da tabela própria e compras pelas porções', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  await waitForSync(page);
  await openTab(page, 'Bem-estar');
  await page.getByRole('link', { name: /Receitas/ }).click();
  await expect(page.getByRole('button', { name: 'Nova receita' })).toBeVisible();

  // Tabela nutricional: dois alimentos à mão
  await page.getByRole('button', { name: 'Tabela nutricional' }).click();
  const foods = [
    { name: 'Ovo', basis: 'unidade', kcal: '70', protein: '6', carbs: '0,5', fat: '5' },
    { name: 'Açúcar', basis: '100 g', kcal: '400', protein: '0', carbs: '100', fat: '0' },
  ];
  for (const f of foods) {
    await page.getByRole('button', { name: 'Novo alimento' }).click();
    await page.getByRole('textbox', { name: 'Alimento (ex.: Arroz branco cozido)' }).fill(f.name);
    await page.getByRole('radio', { name: f.basis }).click();
    await page.getByRole('textbox', { name: 'kcal' }).fill(f.kcal);
    await page.getByRole('textbox', { name: 'Proteína (g)' }).fill(f.protein);
    await page.getByRole('textbox', { name: 'Carboidrato (g)' }).fill(f.carbs);
    await page.getByRole('textbox', { name: 'Gordura (g)' }).fill(f.fat);
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  }
  await expect(shown(page, 'Por unidade: 70 kcal · P 6 g · C 0,5 g · G 5 g')).toBeVisible();
  await page.goBack();

  // A receita nasce na tela; as propriedades entram pela API (o editor de propriedades tem o seu teste)
  await page.getByRole('button', { name: 'Nova receita' }).click();
  await page.waitForURL(/\/nota\//);
  const noteId = new URL(page.url()).pathname.split('/').pop();
  const title = `Bolo ${Date.now()}`;
  await waitForSync(page);
  await page.goBack();
  await adminRest(`notes?id=eq.${noteId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title,
      props: {
        porções: 4,
        ingredientes: ['3 ovos', '200 g de açúcar', '2 xícaras de farinha'],
      },
    }),
  });
  // 3 ovos (210) + 200 g de açúcar (800) = 1010 kcal ÷ 4 porções
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole('link', { name: `Abrir a receita ${title}` })).toBeVisible({
      timeout: 3_000,
    });
  }).toPass({ timeout: 30_000 });
  await expect(shown(page, 'Rende 4 porções · 3 ingredientes')).toBeVisible();
  await expect(shown(page, /^Por porção: 253 kcal · proteína 4,5 g/)).toBeVisible();
  await expect(shown(page, 'Sem dados na sua tabela: xícaras de farinha')).toBeVisible();

  // Compras: 8 porções dobra tudo; a medida caseira fica como está
  await page.getByRole('checkbox', { name: `Escolher ${title} para as compras` }).click();
  await page.getByRole('textbox', { name: `Porções de ${title} para as compras` }).fill('8');
  await page.getByRole('button', { name: /Adicionar à lista de compras \(1 receita\)/ }).click();
  await page.getByRole('menuitem', { name: 'Caixa de entrada' }).click();
  await expect(page.getByText('3 tarefas serão criadas')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Ovos (6)', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Açúcar (400 g)', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Xícaras de farinha (4)', { exact: true }).last()).toBeVisible();
});
