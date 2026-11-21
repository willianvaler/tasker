import { expect, test } from '@playwright/test';

import { createPage, shown, signUp } from './helpers';

// GP1 (D313): reunião com pauta, condução por item, ata como anotação, ação que vira tarefa e a
// próxima da série com as ações da anterior.

test('reunião: pauta, conduzir, encerrar com ata e ação, próxima da série', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await signUp(page, testInfo);
  await createPage(page, { folder: `Equipe ${Date.now()}`, name: 'Semanal', type: 'Reunião' });

  await page.getByRole('textbox', { name: 'Data da reunião' }).fill('amanhã');
  await page.getByRole('textbox', { name: 'Hora', exact: true }).fill('10h');
  await page.getByRole('textbox', { name: 'Duração em minutos' }).fill('45');
  await page.getByRole('textbox', { name: 'Lugar ou link da chamada' }).fill('Sala 2');
  await page.getByRole('radio', { name: 'Toda semana' }).click();
  await page.getByRole('button', { name: 'Salvar data e lugar' }).click();
  await expect(shown(page, /· 10:00 · 45 min · Sala 2/)).toBeVisible();

  const item = page.getByRole('textbox', { name: 'Item da pauta' });
  const minutes = page.getByRole('textbox', { name: 'Minutos do item' });
  await item.fill('Orçamento');
  await minutes.fill('10');
  await page.getByRole('button', { name: 'Adicionar à pauta' }).click();
  await expect(page.getByRole('button', { name: 'Abrir Orçamento' })).toBeVisible();
  await item.fill('Viagem');
  await minutes.fill('5');
  await page.getByRole('button', { name: 'Adicionar à pauta' }).click();
  await expect(page.getByRole('button', { name: 'Abrir Viagem' })).toBeVisible();
  await expect(shown(page, '15 de 45 min previstos')).toBeVisible();

  await page.getByRole('button', { name: 'Começar reunião' }).click();
  await expect(shown(page, 'Em andamento', { exact: true })).toBeVisible();
  const notes = page.getByRole('textbox', { name: 'Anotações de Orçamento' });
  await notes.fill('Aprovado.\n[ ] mandar a proposta amanhã');
  await page.getByRole('textbox', { name: 'Anotações gerais' }).click();
  await page.getByRole('button', { name: 'Próximo item' }).click();
  await expect(page.getByRole('textbox', { name: 'Anotações de Viagem' })).toBeVisible();

  await page.getByRole('button', { name: 'Encerrar reunião' }).click();
  await page.getByRole('button', { name: 'Encerrar reunião' }).last().click();
  await expect(shown(page, 'Reunião encerrada: ata pronta e 1 ação virou tarefa')).toBeVisible({
    timeout: 15_000,
  });
  await expect(shown(page, 'Encerrada', { exact: true })).toBeVisible();

  // A ata é uma anotação com a pauta, as anotações e a ação
  await page.getByRole('button', { name: 'Abrir a ata' }).click();
  await expect(shown(page, /Aprovado\./).first()).toBeVisible();
  await expect(shown(page, /mandar a proposta/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Voltar' }).first().click();

  // A próxima da série traz as ações da anterior
  await page.getByRole('button', { name: 'Marcar a próxima' }).click();
  await expect(shown(page, 'Ações da última reunião')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('link', { name: /mandar a proposta/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir Orçamento' })).toBeVisible();
  await expect(shown(page, 'Planejada', { exact: true })).toBeVisible();
});
