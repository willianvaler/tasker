import { expect, test } from '@playwright/test';

import { signUp } from './helpers';

// AC3.10: as duas fotos da free-exercise-db na ficha da Biblioteca, servidas pelo nosso Storage
// (precisa do `node scripts/exercicios/fotos.mjs` ter rodado no Supabase local)
test('fotos dos exercícios: ficha e miniatura na Biblioteca', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await page.goto('/biblioteca/free-Barbell_Squat');
  await expect(page.getByRole('heading', { name: 'Agachamento com barra' })).toBeVisible();
  const photo = page.getByRole('img', {
    name: 'Foto de Agachamento com barra: posição inicial e final',
  });
  await expect(photo).toBeVisible();
  await expect(page.getByText('Fotos: free-exercise-db (domínio público)')).toBeVisible();
  // As duas posições carregaram do bucket (não é só a caixa vazia)
  await expect
    .poll(() =>
      photo
        .locator('img')
        .evaluateAll((imgs) =>
          imgs.map((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth),
        ),
    )
    .toEqual([480, 480]);

  // Exercício só do dataset MIT: sem foto e sem caixa vazia
  await page.goto('/biblioteca/mit-0180');
  await expect(page.getByRole('heading', { name: 'Remada sentada baixa' })).toBeVisible();
  await expect(page.getByRole('img', { name: /^Foto de/ })).toHaveCount(0);

  // Lista: miniatura parada
  await page.goto('/biblioteca');
  await page.getByPlaceholder(/Buscar/).fill('agachamento com barra');
  await expect(
    page.getByRole('img', { name: 'Foto de Agachamento com barra: posição inicial e final' }),
  ).toBeVisible();
});
