import { expect, test } from '@playwright/test';

import { openSettings, openTab, signUp } from './helpers';

// CD29: o fundo do modo escuro é escolhido em Configurações → Aparência e fica no aparelho
test('modo escuro: escolher o fundo verde-escuro', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await openSettings(page);
  await page.getByRole('radio', { name: 'Escuro', exact: true }).click();
  const backgrounds = page.getByRole('radiogroup', { name: 'Fundo do modo escuro' });
  await expect(backgrounds.getByRole('radio', { name: 'Marrom' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  const paper = () =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--paper').trim(),
    );
  expect(await paper()).toBe('27 26 23');

  await backgrounds.getByRole('radio', { name: 'Verde-escuro' }).click();
  await expect(backgrounds.getByRole('radio', { name: 'Verde-escuro' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect(await paper()).toBe('20 28 24');
  await page.screenshot({ path: testInfo.outputPath('configuracoes.png') });

  // Fica depois de recarregar; no claro, as variáveis do fundo saem
  await page.reload();
  await openTab(page, 'Hoje');
  await expect.poll(paper).toBe('20 28 24');
  await page.screenshot({ path: testInfo.outputPath('hoje.png') });
  await openSettings(page);
  await page.getByRole('radio', { name: 'Claro', exact: true }).click();
  await expect.poll(paper).toBe('246 242 234');
});
