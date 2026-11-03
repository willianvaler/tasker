import { expect, test } from '@playwright/test';

import { signUp } from './helpers';

// OB3 (ESCOPO_V11 §7): comandos de barra, callouts, destaque, notas de rodapé, tabela, sumário e
// contagem de palavras.
test('anotações: comandos de barra, callout, destaque, rodapé, tabela e sumário', async ({
  page,
}, testInfo) => {
  const desktop = testInfo.project.name === 'desktop';
  await signUp(page, testInfo);
  if (desktop) await page.getByRole('button', { name: 'Nova anotação' }).first().click();
  else {
    await page.getByRole('button', { name: 'Novo', exact: true }).last().click();
    await page.getByRole('menuitem', { name: 'Anotação' }).click();
  }
  await page.getByRole('textbox', { name: 'Título da anotação' }).fill(`Viagem ${Date.now()}`);
  const body = page.getByRole('textbox', { name: 'Texto da anotação' });

  // "/" no começo da linha abre os comandos; digitar filtra; Enter insere
  await body.click();
  await body.pressSequentially('/');
  await expect(page.getByRole('list', { name: 'Comandos' })).toBeVisible();
  await body.pressSequentially('tab');
  await expect(page.getByRole('button', { name: 'Tabela' })).toBeVisible();
  await body.press('Enter');
  await expect(body).toHaveValue('| Coluna 1 | Coluna 2 |\n| --- | --- |\n|  |  |');
  await expect(page.getByRole('list', { name: 'Comandos' })).toHaveCount(0);

  await body.fill(
    [
      '# Roteiro',
      '',
      'Levar ==protetor solar== e o mapa[^1].',
      '',
      '> [!dica] Água',
      '> Garrafa de 1 L',
      '',
      '> [!aviso]- Escondido',
      '> só abre ao tocar',
      '',
      '## Malas',
      '',
      '| Item | Quem |',
      '| --- | --- |',
      '| Barraca | Ana |',
      '',
      '[^1]: Impresso, sem internet na trilha.',
    ].join('\n'),
  );
  await expect(page.getByText(/^\d+ palavras · /)).toContainText('27 palavras');

  await page.getByRole('button', { name: 'Visualizar' }).click();
  await expect(page.getByTestId('callout-tip')).toContainText('Garrafa de 1 L');
  // Recolhido ("-"): só o título até tocar
  const folded = page.getByRole('button', { name: 'Escondido' });
  await expect(folded).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('só abre ao tocar')).toHaveCount(0);
  await folded.click();
  await expect(page.getByText('só abre ao tocar')).toBeVisible();
  await expect(page.getByTestId('note-highlight')).toHaveText('protetor solar');
  await expect(page.getByText('==protetor')).toHaveCount(0);
  await expect(page.getByTestId('note-footnotes')).toContainText('Impresso, sem internet');
  await expect(page.getByText('[^1]')).toHaveCount(0);
  await expect(page.getByText('Barraca', { exact: true })).toBeVisible();

  // Sumário: ao lado no computador, num menu no celular
  if (desktop) {
    const outline = page.getByRole('navigation', { name: 'Sumário' });
    await expect(outline.getByRole('link')).toHaveText(['Roteiro', 'Malas']);
    await outline.getByRole('link', { name: 'Malas' }).click();
  } else {
    await page.getByRole('button', { name: 'Sumário' }).click();
    await page.getByRole('menuitem', { name: /Malas/ }).click();
  }
  await expect(page.getByText('Malas', { exact: true }).last()).toBeInViewport();
});
