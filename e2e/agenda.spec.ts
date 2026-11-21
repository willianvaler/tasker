import { expect, test } from '@playwright/test';

import { isRpc, openSettings, shown, signUp } from './helpers';

// AG1 (D310): disponibilidade da agenda em Configurações → Agenda. A semana por texto ("9-12,
// 14-18"), copiar para os dias úteis, salvar, os próximos 7 dias e uma exceção de um trecho.

test('disponibilidade: semana, dias úteis, exceção e recarregar', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await openSettings(page);
  await page.getByRole('button', { name: 'Disponibilidade' }).click();
  await expect(page.getByRole('heading', { name: 'Disponibilidade' })).toBeVisible();

  const monday = page.getByRole('textbox', { name: 'Horários de seg' });
  await monday.fill('9 às 12 e 14-18');
  await monday.blur();
  await expect(monday).toHaveValue('09:00–12:00, 14:00–18:00');

  // Texto que não é horário avisa e não deixa salvar
  const saturday = page.getByRole('textbox', { name: 'Horários de sáb' });
  await saturday.fill('de manhã');
  await expect(shown(page, /Não entendi\. Escreva como 9-12/)).toBeVisible();
  const save = page.getByRole('button', { name: 'Salvar', exact: true });
  await expect(save).toBeDisabled();
  await saturday.fill('');

  await page.getByRole('button', { name: 'Copiar segunda para os dias úteis' }).click();
  await expect(page.getByRole('textbox', { name: 'Horários de sex' })).toHaveValue(
    '09:00–12:00, 14:00–18:00',
  );
  await expect(shown(page, '35 h por semana')).toBeVisible();

  const saved = page.waitForResponse((r) => isRpc(r, 'set_availability'));
  await save.click();
  await saved;
  await expect(shown(page, 'Disponibilidade salva')).toBeVisible();

  // Exceção de um trecho amanhã (só se amanhã for dia útil o trecho aparece cortado; o texto da
  // exceção aparece sempre)
  await page.getByRole('textbox', { name: 'De (data)' }).fill('amanhã');
  await page.getByRole('textbox', { name: 'Horário (opcional)' }).fill('10-11');
  await page.getByRole('textbox', { name: 'Motivo (opcional)' }).fill('Dentista');
  const added = page.waitForResponse(
    (r) => r.url().includes('availability_exceptions') && r.request().method() === 'POST' && r.ok(),
  );
  await page.getByRole('button', { name: 'Adicionar exceção' }).click();
  await added;
  await expect(
    page.getByRole('button', { name: /Tirar a exceção .* 10:00–11:00 · Dentista/ }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Horários de qua' })).toHaveValue(
    '09:00–12:00, 14:00–18:00',
  );
  await expect(page.getByRole('textbox', { name: 'Horários de dom' })).toHaveValue('');
  await expect(shown(page, /10:00–11:00 · Dentista/).first()).toBeVisible();

  // Tirar a exceção
  const removed = page.waitForResponse(
    (r) =>
      r.url().includes('availability_exceptions') && r.request().method() === 'DELETE' && r.ok(),
  );
  await page.getByRole('button', { name: /Tirar a exceção/ }).click();
  await removed;
  await expect(shown(page, 'Nenhuma exceção marcada.')).toBeVisible();
});
