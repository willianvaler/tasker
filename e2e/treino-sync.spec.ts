import { expect, test } from '@playwright/test';

import { createWorkout, shown, signUp, waitForSync } from './helpers';

// Relato de 16/10: o celular segurou as séries (tela travada) e, ao enviar, o segundo exercício
// apareceu como "3 de 3" sem ter sido feito
test('Modo Treino: séries presas no aparelho não pulam o exercício seguinte ao sincronizar', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Mesmo fluxo nos dois perfis');
  test.setTimeout(120_000);
  await signUp(page, testInfo);
  await createWorkout(page, 'Sexta');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  for (const line of ['Supino 4x10', 'Desenvolvimento 3x10', 'Elevação 4x12']) {
    await input.fill(line);
    await input.press('Enter');
  }
  await expect(page.getByRole('checkbox', { name: 'Elevação', exact: true })).toBeVisible();
  await waitForSync(page);

  await page.getByRole('button', { name: 'Iniciar treino' }).click();
  await expect(page.getByRole('heading', { name: 'Supino' })).toBeVisible();
  await page.context().setOffline(true);
  for (let i = 1; i <= 4; i++) {
    await expect(shown(page, `Série ${i} de 4`)).toBeVisible();
    await page.getByRole('button', { name: 'Feita' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Desenvolvimento' })).toBeVisible();
  await expect(shown(page, 'Série 1 de 3')).toBeVisible();
  await page.getByRole('button', { name: 'Feita' }).click();
  await expect(shown(page, 'Série 2 de 3')).toBeVisible();

  // Volta a conexão: tudo sobe de uma vez e o servidor devolve o estado
  await page.context().setOffline(false);
  await waitForSync(page);
  for (let i = 0; i < 6; i++) {
    await expect(page.getByRole('heading', { name: 'Desenvolvimento' })).toBeVisible();
    await expect(shown(page, 'Série 2 de 3')).toBeVisible();
    await page.waitForTimeout(1000);
  }
});
