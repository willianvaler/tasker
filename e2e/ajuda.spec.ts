import { expect, test } from '@playwright/test';

import { signUp } from './helpers';

test('ajuda: artigos por idioma, busca no texto e abrir um artigo', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await page.goto('/ajuda');
  await expect(page.getByRole('link', { name: 'Começando em 1 minuto' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Perguntas frequentes' })).toBeVisible();

  // A busca procura dentro dos artigos (carvão só aparece no das dependências)
  await page.getByRole('textbox', { name: 'Buscar' }).fill('carvão');
  await expect(page.getByRole('link', { name: 'Tarefas que dependem de outras' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Começando em 1 minuto' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Tarefas que dependem de outras' }).click();
  await expect(page.getByRole('heading', { name: 'Tarefas que dependem de outras' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Estrito ou flexível' })).toBeVisible();
  await page.getByRole('button', { name: 'Todos os artigos' }).click();
  await expect(page.getByRole('link', { name: 'Começando em 1 minuto' })).toBeVisible();
});

test('ajuda contextual e refazer a introdução', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await page.getByRole('button', { name: 'Ajuda sobre esta tela' }).click();
  await expect(page.getByRole('heading', { name: 'Começando em 1 minuto' })).toBeVisible();

  await page.goto('/ajuda');
  await page.getByRole('button', { name: 'Refazer a introdução' }).click();
  await page.getByRole('button', { name: 'Pular introdução' }).click();
  await expect(page.getByRole('heading', { name: /^Olá/ })).toBeVisible();
});
