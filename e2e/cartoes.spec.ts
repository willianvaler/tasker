import { expect, test } from '@playwright/test';

import { shown, signUp, waitForSync } from './helpers';

// ET1 (D386): `pergunta ?:: resposta` numa anotação vira cartão; a revisão mostra a resposta, grava
// a nota, devolve o que errou no fim da sessão e não repete o que acertou depois de recarregar.
test('cartões: da anotação para a revisão do dia', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const desktop = testInfo.project.name === 'desktop';
  await signUp(page, testInfo);
  await waitForSync(page);
  if (desktop) await page.getByRole('button', { name: 'Nova anotação' }).first().click();
  else {
    await page.getByRole('button', { name: 'Novo', exact: true }).last().click();
    await page.getByRole('menuitem', { name: 'Anotação' }).click();
  }
  await page.getByRole('textbox', { name: 'Título da anotação' }).fill(`Geografia ${Date.now()}`);
  await page
    .getByRole('textbox', { name: 'Texto da anotação' })
    .fill('- Capital da França ?:: Paris\nCapital do Peru ?:: Lima');
  // Salva sozinho; os cartões nascem no servidor e voltam pelo sync
  await page.waitForTimeout(1500);
  await waitForSync(page);

  await page.getByRole('button', { name: 'Mais opções da anotação' }).click();
  await page.getByRole('menuitem', { name: 'Revisar cartões' }).click();
  await expect(shown(page, 'Hoje: 2 cartões')).toBeVisible({ timeout: 20_000 });

  // Primeiro cartão: errar volta no fim
  await expect(shown(page, 'Capital da França')).toBeVisible();
  await page.getByRole('button', { name: 'Mostrar resposta' }).click();
  await expect(shown(page, 'Paris')).toBeVisible();
  await page.getByRole('button', { name: 'Errei, 1 dia' }).click();

  await expect(shown(page, 'Capital do Peru')).toBeVisible();
  await page.getByRole('button', { name: 'Mostrar resposta' }).click();
  await page.getByRole('button', { name: 'Bom, 1 dia' }).click();

  // O que errou volta
  await expect(shown(page, 'Capital da França')).toBeVisible();
  await page.getByRole('button', { name: 'Mostrar resposta' }).click();
  await page.getByRole('button', { name: 'Bom, 1 dia' }).click();
  await expect(shown(page, 'Pronto por hoje: 3 revisões.')).toBeVisible();

  // Recarregar: os dois já foram vistos hoje e só voltam amanhã
  await waitForSync(page);
  await expect(async () => {
    await page.reload();
    await expect(shown(page, 'Nada para revisar hoje.')).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
});
