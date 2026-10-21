import { expect, test } from '@playwright/test';

import { adminRest, createWorkout, shown, signUp } from './helpers';

// AC8.6: o mapa muscular do treino enquanto ele é montado (recolhido numa linha) e no resumo do
// fim, pelos exercícios ligados à Biblioteca
test('mapa muscular na montagem e no resumo do fim', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'O mapa é o mesmo; basta um perfil');
  await signUp(page, testInfo);
  const pageId = await createWorkout(page, `Peito ${Date.now()}`);
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  const title = `Supino com corrente ${testInfo.project.name}-${Date.now()}`;
  await input.fill(`${title} 2x10 40kg`);
  await input.press('Enter');
  await expect(page.getByRole('button', { name: `Detalhes de ${title}` })).toBeVisible();

  // Liga o item ao exercício da Biblioteca (peito; tríceps e ombros de sinergistas)
  let id: string | undefined;
  await expect
    .poll(
      async () =>
        (id = (
          await adminRest(
            `tasks?page_id=eq.${pageId}&title=eq.${encodeURIComponent(title)}&select=id`,
          )
        )[0]?.id),
      { timeout: 20_000 },
    )
    .toBeTruthy();
  await adminRest(`tasks?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ exercise_id: 'free-Chain_Press' }),
  });
  await page.reload();

  // Montagem: uma linha com os músculos; abrir mostra o mapa
  const toggle = page.getByRole('button', { name: /^Músculos deste treino: Peito, .*Tríceps/ });
  await expect(toggle).toBeVisible({ timeout: 20_000 });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(
    page.getByRole('img', { name: /^Mapa muscular\. Trabalhados: Peito/ }),
  ).toBeVisible();

  // Fim do treino: o resumo com os músculos trabalhados, até fechar
  await page.getByRole('button', { name: 'Iniciar treino' }).click();
  await page.getByRole('button', { name: 'Feita' }).click();
  await page.keyboard.press('r');
  await page.getByRole('button', { name: 'Feita' }).click();
  await expect(shown(page, /^Treino concluído · 2 séries/)).toBeVisible({ timeout: 10_000 });
  await expect(shown(page, 'Músculos trabalhados')).toBeVisible();
  await expect(
    page.getByRole('img', { name: /^Mapa muscular\. Trabalhados: Peito/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Iniciar treino' })).toBeVisible();
});
