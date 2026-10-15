import { expect, test, type Page } from '@playwright/test';

import { signUp, waitForSync } from './helpers';

const bar = (page: Page) => page.getByRole('timer');

test('timer: um ativo, com fim absoluto, o mesmo nos dois aparelhos', async ({
  browser,
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'A paleta (Ctrl+K) é do computador');
  test.setTimeout(90_000);
  const email = await signUp(page, testInfo);

  // Iniciar pela paleta
  await page.keyboard.press('Control+k');
  await page.getByRole('textbox', { name: 'Buscar ou executar' }).fill('temporizador de 5');
  await page.keyboard.press('Enter');
  await expect(bar(page)).toHaveAccessibleName(/^Temporizador: 4:5\d$|^Temporizador: 5:00$/);

  // Recarregar não zera: o restante vem do horário de fim
  await waitForSync(page);
  await page.reload();
  await expect(bar(page)).toHaveAccessibleName(/^Temporizador: 4:[45]\d$/, { timeout: 15_000 });

  // O mesmo usuário em outro aparelho vê o mesmo timer e pausa
  const other = await browser.newContext({ ...testInfo.project.use, locale: 'pt-BR' });
  const b = await other.newPage();
  await b.goto('/');
  await b.getByPlaceholder('E-mail').fill(email);
  await b.getByPlaceholder('Senha').fill('senha-forte-123');
  await b.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(bar(b)).toHaveAccessibleName(/^Temporizador: 4:[45]\d$/, { timeout: 20_000 });
  await b.getByRole('button', { name: 'Pausar' }).click();
  await expect(bar(b)).toHaveAccessibleName(/, pausado$/);
  await expect(bar(page)).toHaveAccessibleName(/, pausado$/, { timeout: 20_000 });

  // Um ativo por pessoa: o cronômetro novo substitui o temporizador
  await page.keyboard.press('Control+k');
  await page.getByRole('textbox', { name: 'Buscar ou executar' }).fill('cronômetro');
  await page.keyboard.press('Enter');
  await expect(bar(page)).toHaveAccessibleName(/^Cronômetro: 0:0\d$/);
  await expect(bar(b)).toHaveAccessibleName(/^Cronômetro: /, { timeout: 20_000 });
  await expect(bar(b)).toHaveCount(1);

  // Parar em um some no outro
  await b.getByRole('button', { name: 'Parar' }).click();
  await expect(bar(b)).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0, { timeout: 20_000 });
  await other.close();
});
