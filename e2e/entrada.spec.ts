import { expect, test } from '@playwright/test';

// V4 §5 (S1): sem conta, a primeira tela apresenta o app; os botões levam ao formulário
test('entrada: apresentação, "Começar agora" abre o criar conta e a privacidade é pública', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Tarefas, hábitos e projetos, com um jogo por cima.' }),
  ).toBeVisible();
  for (const name of ['Captura rápida', 'Pastas, projetos e times', 'Funciona sem internet'])
    await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Tela Hoje com tarefas e o campo de captura' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Começar agora' }).click();
  await expect(page.getByPlaceholder('Seu nome')).toBeInViewport();
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click();
  await expect(page.getByPlaceholder('Seu nome')).toHaveCount(0);
  await expect(page.getByPlaceholder('E-mail')).toBeVisible();

  await page.getByRole('link', { name: 'Política de privacidade' }).click();
  await expect(page.getByText('Quem cuida dos dados')).toBeVisible();
  await expect(page).toHaveURL(/privacidade/);
});
