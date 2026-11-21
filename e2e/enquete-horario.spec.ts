import { expect, test } from '@playwright/test';

import { signUp } from './helpers';

// Enquete de horário (AG4, D319): a dona propõe horários e manda o link; quem abre vota sem conta
// (e muda o voto); a dona vê quem pode e fecha num horário, que vira tarefa; o link mostra o
// horário escolhido.

test('enquete de horário: propor, votar sem conta e fechar', async ({ page, browser }, testInfo) => {
  await signUp(page, testInfo);
  await page.goto('/enquetes');
  await page.getByRole('button', { name: 'Nova enquete' }).click();
  const title = `Café ${testInfo.project.name}${Date.now()}`;
  await page.getByRole('textbox', { name: 'Título' }).fill(title);
  const typed = page.getByRole('textbox', { name: 'Outro horário' });
  const year = new Date().getFullYear() + 1;
  for (const slot of [`10/03/${year} 10:00`, `11/03/${year} 15h`]) {
    await typed.fill(slot);
    await page.getByRole('button', { name: 'Incluir' }).click();
  }
  await expect(page.getByRole('button', { name: /^Tirar / })).toHaveCount(2);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  const link = (await page.getByTestId('poll-link').textContent())?.trim() ?? '';
  expect(link).toContain('/horario/');

  // Quem recebe o link, sem conta
  const guest = await browser.newContext();
  const other = await guest.newPage();
  await other.goto(link);
  await expect(other.getByRole('heading', { name: title })).toBeVisible();
  await other.getByRole('checkbox').first().click();
  await other.getByRole('textbox', { name: 'Seu nome' }).fill('Bia');
  await other.getByRole('button', { name: 'Enviar resposta' }).click();
  await expect(other.getByText('Resposta enviada', { exact: false })).toBeVisible();
  // Recarregar lembra o voto (para mudar)
  await other.reload();
  await expect(other.getByRole('button', { name: 'Atualizar resposta' })).toBeVisible();
  await expect(other.getByRole('checkbox').first()).toHaveAttribute('aria-checked', 'true');
  await expect(other.getByText('1 pode: Bia')).toBeVisible();

  // A dona vê e fecha no horário votado
  await page.reload();
  await expect(page.getByText('1 resposta')).toBeVisible();
  await page.getByRole('button', { name: /^Fechar em / }).first().click();
  await page.getByRole('button', { name: 'Fechar neste horário' }).last().click();
  await expect(page.getByRole('button', { name: 'Abrir a tarefa' })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir a tarefa' }).click();
  await expect(page.getByRole('textbox', { name: 'Título', exact: true })).toHaveValue(title);

  // O link agora mostra o horário escolhido
  await other.reload();
  await expect(other.getByText(/^Ficou para /)).toBeVisible();
  await expect(other.getByRole('button', { name: /^Adicionar à agenda/ })).toBeVisible();
  await guest.close();
});
