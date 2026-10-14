import { devices, expect, test, type Browser } from '@playwright/test';

import { openTab, signUp, waitForSync } from './helpers';

// Aceite da Fase H (V3 §2): "carvão → fogo". A lenha comprada pelo Greg libera o fogo do Willian,
// inclusive quando o Greg conclui sem internet e sincroniza depois.

async function join(browser: Browser, link: string, name: string) {
  const context = await browser.newContext({ ...devices['Desktop Chrome'] });
  const page = await context.newPage();
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Churrasco' })).toBeVisible();
  await page.getByPlaceholder('Seu nome').fill(name);
  await page
    .getByPlaceholder('E-mail')
    .fill(`e2e-fluxo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@teste.local`);
  await page.getByPlaceholder('Senha').fill('senha-forte-123');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.getByRole('button', { name: 'Participar' }).click();
  await expect(page.getByRole('heading', { name: 'Churrasco' })).toBeVisible();
  return page;
}

test('carvão → fogo: bloqueada até o pré-requisito, liberada depois do sync offline', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Duas pessoas: desktop basta');
  test.setTimeout(120_000);

  // Willian cria o projeto e chama o Greg como Editor
  await signUp(page, testInfo);
  await openTab(page, 'Pastas');
  await page.getByRole('button', { name: 'Usar modelo' }).click();
  await page.getByRole('button', { name: 'Modelo Churrasco' }).click();
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Churrasco' })).toBeVisible();
  await page.getByRole('button', { name: 'Pessoas' }).click();
  await page.getByRole('button', { name: 'Gerar link de convite' }).click();
  const link = (await page.getByLabel('Link de convite').textContent()) ?? '';
  await page.getByRole('button', { name: 'Voltar' }).click();
  const greg = await join(browser, link, 'Greg Souza');

  // A lenha é do Greg; o fogo depende dela (^ na captura, com o autocomplete)
  await page.getByRole('link', { name: 'Compras' }).last().click();
  await expect(page.getByRole('heading', { name: 'Compras' })).toBeVisible();
  const compras = page.url();
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Comprar lenha @Greg');
  await input.press('Enter');
  await expect(page.getByRole('checkbox', { name: 'Concluir Comprar lenha' })).toBeVisible();
  await input.click();
  await input.pressSequentially('Acender o fogo ^len');
  await expect(page.getByRole('button', { name: 'Depender de Comprar lenha' })).toBeVisible({
    timeout: 15_000,
  });
  await input.press('Enter');
  await expect(input).toHaveValue('Acender o fogo ^Comprarlenha ');
  await input.press('Enter');

  // Bloqueada: cadeado, o que espera, e no modo estrito não conclui
  await expect(page.getByText('Aguardando: Comprar lenha')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('checkbox', { name: 'Concluir Acender o fogo' })).toBeDisabled();

  // No painel: "Depende de" mostra a ligação
  await page.getByRole('button', { name: 'Detalhes de Acender o fogo' }).click();
  await expect(page.getByRole('button', { name: 'Opções de Comprar lenha' })).toBeVisible();
  await page.getByRole('button', { name: 'Voltar' }).click();
  await waitForSync(page);

  // O Greg compra a lenha sem internet e sincroniza depois
  await greg.getByRole('link', { name: 'Compras' }).last().click();
  const lenha = greg.getByRole('checkbox', { name: 'Concluir Comprar lenha' });
  await expect(lenha).toBeVisible({ timeout: 15_000 });
  await waitForSync(greg);
  await greg.context().setOffline(true);
  await lenha.click();
  await expect(
    greg.getByRole('alert').filter({ hasText: 'Concluída: Comprar lenha' }),
  ).toBeVisible();
  await greg.context().setOffline(false);
  await waitForSync(greg);

  // O Willian vê o fogo liberado e é avisado
  await expect(page.getByText('Aguardando: Comprar lenha')).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByRole('checkbox', { name: 'Concluir Acender o fogo' })).toBeEnabled();
  await page.getByRole('link', { name: /^Notificações/ }).first().click();
  await expect(
    page.getByText('"Comprar lenha" foi concluída: já pode "Acender o fogo"'),
  ).toBeVisible({
    timeout: 15_000,
  });

  // Lote com ^2: o item 3 depende do item 2
  await page.getByRole('navigation').getByRole('link', { name: 'Compras' }).first().click();
  await expect(page).toHaveURL(compras);
  await page.getByRole('button', { name: 'Adicionar várias' }).click();
  await page
    .getByRole('textbox', { name: 'Lista de tarefas' })
    .fill('Separar espetos\nTemperar a carne\nAssar ^2');
  await expect(page.getByText('depende de: Temperar a carne')).toBeVisible();
  await page.getByRole('button', { name: 'Criar 3' }).click();
  await expect(page.getByText('Aguardando: Temperar a carne').last()).toBeVisible({
    timeout: 15_000,
  });

  await greg.context().close();
});
