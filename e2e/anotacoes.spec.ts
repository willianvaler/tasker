import { expect, test } from '@playwright/test';

import { openTab, signUp } from './helpers';

// W3 e D187: anotações em Markdown simples. No computador ficam na barra lateral; no celular, no Início.
test('anotações: criar, formatar, salvar sozinho, reabrir e apagar', async ({ page }, testInfo) => {
  const desktop = testInfo.project.name === 'desktop';
  await signUp(page, testInfo);
  if (!desktop) await openTab(page, 'Início');
  await page.getByRole('button', { name: 'Nova anotação' }).first().click();
  const title = `Mercado ${testInfo.project.name} ${Date.now()}`;
  await page.getByRole('textbox', { name: 'Título da anotação' }).fill(title);
  const body = page.getByRole('textbox', { name: 'Texto da anotação' });
  await body.fill('leite\npão');
  // Lista nas duas linhas e negrito numa palavra nova
  await body.press('Control+a');
  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  await expect(body).toHaveValue('- leite\n- pão');
  await body.press('End');
  await body.pressSequentially('\n');
  await page.getByRole('button', { name: 'Negrito' }).click();
  await body.pressSequentially('café');
  await expect(body).toHaveValue('- leite\n- pão\n**café**');

  // Visualizar: formatado, sem as marcas
  await page.getByRole('button', { name: 'Visualizar' }).click();
  await expect(page.getByText('café', { exact: true })).toBeVisible();
  await expect(page.getByText('**café**')).toHaveCount(0);

  // Salva sozinho: recarregar não perde (abre formatada; Editar mostra o texto)
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByRole('button', { name: 'Editar' }).click({ timeout: 15_000 });
  await expect(body).toHaveValue('- leite\n- pão\n**café**');

  // Reabrir logo depois de criar (antes ficava em branco até sair e voltar)
  if (desktop) {
    await page.getByRole('button', { name: 'Nova anotação' }).first().click();
    await expect(page.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue('');
    await page.getByRole('navigation').getByRole('link', { name: title }).click();
    await expect(page.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue(title);
  }

  await page.goto('/notas');
  // Na lista, sem as marcas (no computador o título também está na barra lateral)
  const item = page.getByRole('link', { name: new RegExp(`^${title} .*leite`) });
  await expect(item).toBeVisible();
  await expect(item).not.toContainText('**');
  await item.click();
  await page.getByRole('button', { name: 'Apagar' }).click();
  await page.getByRole('button', { name: 'Apagar' }).last().click();
  await expect(page.getByText(title)).toHaveCount(0);
});
