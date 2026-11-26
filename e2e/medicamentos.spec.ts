import { expect, test } from '@playwright/test';

import { openTab, shown, signUp, waitForSync } from './helpers';

// SA3 (D385): remédio com horários. As doses de hoje têm Tomei, Pular e Adiar (até 3), Desfazer, e
// o histórico guarda o que foi respondido.
test('medicamentos: horários, Tomei, Adiar e o histórico', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  await waitForSync(page);
  await openTab(page, 'Bem-estar');
  await page.getByRole('button', { name: 'Concordo e quero registrar remédios' }).click();
  await page.getByRole('button', { name: 'Novo remédio' }).click();
  const name = `Losartana ${Date.now()}`;
  await page.getByRole('textbox', { name: 'Nome (ex.: Losartana 50 mg)' }).fill(name);
  // Meia-noite já passou: as duas doses estão na hora
  await page.getByRole('textbox', { name: 'Horários (opcional)' }).fill('0:01, 0h');
  await expect(page.getByRole('switch', { name: 'Mostrar o nome no aviso' })).not.toBeChecked();
  await page.getByRole('textbox', { name: 'Comprimidos por caixa' }).fill('30');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(shown(page, `1 comprimido · 00:00, 00:01 · Todo dia`)).toBeVisible();

  const first = `00:00 · ${name}`;
  const second = `00:01 · ${name}`;
  await page.getByRole('button', { name: `Tomei ${first}` }).click();
  await expect(page.getByLabel(`${first}: Tomei`)).toBeVisible();

  // Adiar três vezes e o botão para
  const snooze = page.getByRole('button', { name: `Adiar ${second}` });
  await snooze.click();
  await expect(page.getByLabel(new RegExp(`^${second}: Adiado até .* \\(1 de 3\\)`))).toBeVisible();
  await snooze.click();
  await expect(page.getByLabel(new RegExp(`^${second}: Adiado até .* \\(2 de 3\\)`))).toBeVisible();
  await snooze.click();
  await expect(page.getByLabel(new RegExp(`^${second}: Adiado até .* \\(3 de 3\\)`))).toBeVisible();
  await expect(snooze).toHaveAttribute('aria-disabled', 'true');

  // Desfazer a primeira e tomar de novo; fica depois de recarregar
  await page.getByRole('button', { name: `Desfazer ${first}` }).click();
  await page.getByRole('button', { name: `Tomei ${first}` }).click();
  await waitForSync(page);
  await expect(async () => {
    await page.reload();
    await expect(page.getByLabel(`${first}: Tomei`)).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });

  await page.getByRole('button', { name: `Opções de ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Histórico' }).click();
  const history = page.getByLabel(`Histórico de ${name}`);
  await expect(history.getByText('Tomei')).toBeVisible();
  await expect(history.getByText('adiado 3 vezes')).toBeVisible();
});
