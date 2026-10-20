import { devices, expect, test } from '@playwright/test';

import { adminRest, signUp } from './helpers';

test('racha: gasto do projeto divide entre os dois, acerto zera a conta', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'celular',
    'O teste abre o segundo navegador por conta própria',
  );
  test.setTimeout(90_000);

  // Ana cria o projeto e uma página de gastos nele
  await signUp(page, testInfo);
  await page.goto('/templates');
  await page.getByRole('button', { name: 'Modelo Churrasco' }).click();
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Churrasco' })).toBeVisible();
  await page.getByRole('button', { name: 'Nova lista' }).click();
  await page.getByPlaceholder('Nome (ex.: Treino A)').fill('Vaquinha');
  await page.getByRole('radio', { name: /Gastos/ }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { name: /Vaquinha$/ })).toBeVisible();
  const pageId = new URL(page.url()).pathname.split('/').pop()!;

  // Bia entra pelo convite
  await page.getByRole('button', { name: 'Voltar' }).click();
  await page.getByRole('button', { name: 'Pessoas' }).click();
  await page.getByRole('button', { name: 'Gerar link de convite' }).click();
  const link = (await page.getByLabel('Link de convite').textContent()) ?? '';
  const context = await browser.newContext({ ...devices['Desktop Chrome'] });
  const bia = await context.newPage();
  await bia.goto(link);
  await bia.getByPlaceholder('Seu nome').fill('Bia Reis');
  await bia
    .getByPlaceholder('E-mail')
    .fill(`e2e-racha-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@teste.local`);
  await bia.getByPlaceholder('Senha').fill('senha-forte-123');
  await bia.getByRole('checkbox', { name: /aceito os Termos/ }).click();
  await bia.getByRole('button', { name: 'Criar conta' }).click();
  await bia.getByRole('button', { name: 'Participar' }).click();
  await expect(bia.getByRole('heading', { name: 'Churrasco' })).toBeVisible();

  // Ana lança a carne: nasce dividida entre as duas
  await page.goto(`/page/${pageId}`);
  await page.getByRole('textbox', { name: 'Descrição' }).fill('Carne');
  await page.getByRole('textbox', { name: 'Valor' }).fill('300');
  await page.getByRole('textbox', { name: 'Valor' }).press('Enter');
  await expect
    .poll(
      async () =>
        (await adminRest(`expenses?page_id=eq.${pageId}&select=split_among`))[0]?.split_among
          ?.length ?? 0,
      { timeout: 20_000 },
    )
    .toBe(2);
  await page.reload();
  const split = page.getByLabel('Racha de contas');
  await expect(split.getByText(/Bia Reis paga R\$\s150,00 a /)).toBeVisible({ timeout: 15_000 });
  await expect(split.getByText(/tem a receber R\$\s150,00/)).toBeVisible();

  // Bia vê o mesmo e registra o acerto
  await bia.goto(`/page/${pageId}`);
  await bia.getByRole('button', { name: /^Registrar acerto: Bia Reis paga/ }).click();
  await expect(bia.getByText('Tudo acertado.')).toBeVisible();
  // O acerto não é gasto: o total continua R$ 300,00
  await expect(bia.getByLabel(/^Gasto: /)).toHaveAttribute('aria-label', /R\$\s300,00/);
  await context.close();
});
