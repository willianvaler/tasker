import { expect, test } from '@playwright/test';

import { createWorkout, shown, signUp, waitForSync } from './helpers';

test('Modo Treino: séries com Espaço, R pula o descanso, carga, avança, pula e resume', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  await createWorkout(page, 'Treino A');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  for (const line of ['Supino 2x10 40kg', 'Rosca 2x12 10kg']) {
    await input.fill(line);
    await input.press('Enter');
  }
  await expect(page.getByRole('checkbox', { name: 'Rosca', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Iniciar treino' }).click();
  await expect(page.getByRole('heading', { name: 'Supino' })).toBeVisible();
  await expect(shown(page, 'Série 1 de 2')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: '0 de 4 séries' })).toBeVisible();

  // Espaço = série feita; o descanso começa; R pula
  await page.getByRole('heading', { name: 'Supino' }).click();
  await page.keyboard.press(' ');
  await expect(shown(page, 'Série 2 de 2')).toBeVisible();
  const rest = page.getByRole('timer', { name: /^Descanso: faltam/ });
  await expect(rest).toBeVisible();
  await page.keyboard.press('r');
  await expect(rest).toHaveCount(0);

  // Sem sinal na academia: carga +2,5 e a última série; o Supino termina e o treino passa
  // para a Rosca
  await waitForSync(page);
  await page.context().setOffline(true);
  await page.getByRole('button', { name: 'Carga desta série +2,5' }).click();
  await expect(page.getByLabel(/^Carga desta série: 42,5kg/)).toBeVisible();
  await page.getByRole('button', { name: 'Feita' }).click();
  await expect(page.getByRole('heading', { name: 'Rosca' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: '2 de 4 séries' })).toBeVisible();

  // Pular a Rosca encerra: o treino fecha sozinho com o aviso de séries e volume
  // (40 × 10 + 42,5 × 10)
  await page.getByRole('button', { name: 'Pular exercício' }).click();
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: /^Treino concluído · 2 séries · .* · 825 kg · .*1 pulado$/ }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Iniciar treino' })).toBeVisible();
  await page.context().setOffline(false);
  await waitForSync(page);

  await expect(page.getByRole('checkbox', { name: 'Supino', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  // A carga real da série (AC4.7) não muda o plano do item
  await expect(shown(page, '2x10 · 40kg')).toBeVisible();
});
