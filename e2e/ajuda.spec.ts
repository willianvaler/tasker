import { expect, test } from '@playwright/test';

import { signUp } from './helpers';

// D188: cada artigo é um botão que abre o texto logo abaixo, sem trocar de tela
test('ajuda: artigos por idioma, busca no texto e abrir um artigo no lugar', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  await page.goto('/ajuda');
  await expect(page.getByRole('button', { name: 'Começando em 1 minuto' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Perguntas frequentes' })).toBeVisible();

  // A busca procura dentro dos artigos (carvão só aparece no das dependências)
  await page.getByRole('textbox', { name: 'Buscar' }).fill('carvão');
  const deps = page.getByRole('button', { name: 'Tarefas que dependem de outras' });
  await expect(deps).toBeVisible();
  await expect(page.getByRole('button', { name: 'Começando em 1 minuto' })).toHaveCount(0);

  await expect(deps).toHaveAttribute('aria-expanded', 'false');
  await deps.click();
  await expect(deps).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('heading', { name: 'Estrito ou flexível' })).toBeVisible();
  await expect(page).toHaveURL(/\/ajuda$/);
  // Fechar
  await deps.click();
  await expect(page.getByRole('heading', { name: 'Estrito ou flexível' })).toHaveCount(0);

  // Endereço antigo de artigo cai na lista com ele aberto
  await page.goto('/ajuda/dependencias');
  await expect(
    page.getByRole('button', { name: 'Tarefas que dependem de outras' }),
  ).toHaveAttribute('aria-expanded', 'true');
});

test('ajuda contextual e refazer a introdução', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await page.getByRole('button', { name: 'Ajuda sobre esta tela' }).click();
  await expect(page.getByRole('button', { name: 'Começando em 1 minuto' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );

  await page.goto('/ajuda');
  await page.getByRole('button', { name: 'Refazer a introdução' }).click();
  await page.getByRole('button', { name: 'Pular introdução' }).click();
  await expect(page.getByRole('heading', { name: /^Hoje/ })).toBeVisible();
});
