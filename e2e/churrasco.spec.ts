import { devices, expect, test, type Browser, type Page } from '@playwright/test';

import { openTab, signUp } from './helpers';

// Aceite da Fase E (V2 §12): criar o projeto, convidar 2 pessoas com cargos diferentes, delegar,
// e cada um vê só o que pode.

async function join(browser: Browser, link: string, name: string) {
  const context = await browser.newContext({ ...devices['Desktop Chrome'] });
  const page = await context.newPage();
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Churrasco' })).toBeVisible();
  await page.getByPlaceholder('Seu nome').fill(name);
  await page
    .getByPlaceholder('E-mail')
    .fill(`e2e-churrasco-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@teste.local`);
  await page.getByPlaceholder('Senha').fill('senha-forte-123');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.getByRole('button', { name: 'Participar' }).click();
  await expect(page.getByRole('heading', { name: 'Churrasco' })).toBeVisible();
  return page;
}

async function openList(page: Page, name: string) {
  // O último link: o primeiro pode ser o da barra lateral
  await page.getByRole('link', { name }).last().click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

test('Churrasco: Colaboradora e Leitor, delegar, cada um vê só o que pode', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Três pessoas: desktop basta');
  test.setTimeout(120_000);

  // Ana cria o projeto pelo modelo e adiciona um marco
  await signUp(page, testInfo);
  await openTab(page, 'Pastas');
  await page.getByRole('button', { name: 'Usar modelo' }).click();
  await page.getByRole('button', { name: 'Modelo Churrasco' }).click();
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Churrasco' })).toBeVisible();
  const milestone = page.getByRole('textbox', { name: 'Novo marco (ex.: Compras sexta)' });
  await milestone.fill('Compras sexta');
  await milestone.press('Enter');
  await expect(page.getByText('Compras', { exact: true }).first()).toBeVisible();

  // Dois links: Colaborador e Leitor
  await page.getByRole('button', { name: 'Pessoas' }).click();
  await page.getByRole('radio', { name: 'Colaborador', exact: true }).click();
  await page.getByRole('button', { name: 'Gerar link de convite' }).click();
  const field = page.getByLabel('Link de convite');
  await expect(field).toBeVisible();
  const colabLink = (await field.textContent()) ?? '';
  const regenerated = page.waitForResponse((r) => r.url().includes('create_invite') && r.ok());
  await page.getByRole('radio', { name: 'Leitor', exact: true }).click();
  await regenerated;
  await expect(field).not.toHaveText(colabLink);
  const viewerLink = (await field.textContent()) ?? '';
  await page.getByRole('button', { name: 'Voltar' }).click();

  const bia = await join(browser, colabLink, 'Bia Colaboradora');
  const caio = await join(browser, viewerLink, 'Caio Leitor');

  // Ana delega com @ e autocomplete
  await openList(page, 'Compras');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.click();
  await input.pressSequentially('Cerveja gelada @Bi');
  const pick = page.getByRole('button', { name: 'Atribuir a Bia Colaboradora' });
  await expect(pick).toBeVisible({ timeout: 15_000 });
  await input.press('Enter');
  await input.press('Enter');
  await expect(page.getByLabel('Responsáveis: Bia Colaboradora').first()).toBeVisible();

  // Colaboradora: conclui o que é dela, não o dos outros; cria, mas não mexe na estrutura
  await openList(bia, 'Compras');
  const biaGelo = bia.getByRole('checkbox', { name: 'Concluir Cerveja gelada', exact: true });
  await expect(biaGelo).toBeVisible({ timeout: 15_000 });
  await expect(biaGelo).toBeEnabled({ timeout: 15_000 });
  await expect(bia.getByRole('checkbox', { name: 'Concluir Carvão', exact: true })).toBeDisabled();
  await biaGelo.click();
  await expect(
    bia.getByRole('alert').filter({ hasText: 'Concluída: Cerveja gelada' }),
  ).toBeVisible();
  const biaInput = bia.getByRole('textbox', { name: 'Nova tarefa' });
  await biaInput.fill('Farofa da Bia');
  await biaInput.press('Enter');
  await expect(bia.getByRole('checkbox', { name: 'Concluir Farofa da Bia' })).toBeEnabled();
  await bia.getByRole('button', { name: 'Voltar' }).click();
  await expect(bia.getByRole('button', { name: 'Nova lista' })).toHaveCount(0);
  await expect(bia.getByRole('textbox', { name: 'Novo marco (ex.: Compras sexta)' })).toHaveCount(
    0,
  );

  // Leitor: vê tudo, não cria nem conclui
  await openList(caio, 'Compras');
  await expect(caio.getByText('Só leitura: você é leitor deste projeto')).toBeVisible();
  await expect(caio.getByRole('textbox', { name: 'Nova tarefa' })).toHaveCount(0);
  await expect(caio.getByRole('checkbox', { name: 'Concluir Carvão', exact: true })).toBeDisabled();
  await expect(caio.getByText('Farofa da Bia')).toBeVisible({ timeout: 15_000 });

  // A Ana vê a cerveja concluída pela Bia (sai da lista) e as pessoas com os cargos
  await expect(
    page.getByRole('checkbox', { name: 'Concluir Cerveja gelada', exact: true }),
  ).toHaveCount(0, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page.getByText(/Bia Colaboradora\s+Colaborador/)).toBeVisible();
  await expect(page.getByText(/Caio Leitor\s+Leitor/)).toBeVisible();

  await bia.context().close();
  await caio.context().close();
});
