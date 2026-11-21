import { devices, expect, test } from '@playwright/test';

import { isRpc, openSettings, openTab, shown, signUp } from './helpers';

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

// AG2 (D311): tipo de compromisso, reserva sem conta, remarcar pelo link e cancelar pela dona.
test('reservas: tipo, página pública, remarcar e cancelar', async ({ page, browser }, testInfo) => {
  test.setTimeout(120_000);
  await signUp(page, testInfo);
  await openSettings(page);
  await page.getByRole('button', { name: 'Disponibilidade' }).click();
  for (const day of ['seg', 'sáb', 'dom'])
    await page.getByRole('textbox', { name: `Horários de ${day}` }).fill('0-24');
  await page.getByRole('button', { name: 'Copiar segunda para os dias úteis' }).click();
  const saved = page.waitForResponse((r) => isRpc(r, 'set_availability'));
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await saved;

  await page.goto('/compromissos');
  await expect(page.getByRole('heading', { name: 'Compromissos' })).toBeVisible();
  await page.getByRole('button', { name: 'Novo tipo' }).click();
  await page.getByRole('textbox', { name: 'Nome', exact: true }).fill('Conversa E2E');
  await expect(page.getByRole('textbox', { name: 'Final do link' })).toHaveValue('conversa-e2e');
  await page.getByRole('radio', { name: '45 min' }).click();
  await page.getByRole('textbox', { name: 'Antecedência (h)' }).fill('0');
  const created = page.waitForResponse(
    (r) => r.url().includes('booking_types') && r.request().method() === 'POST' && r.ok(),
  );
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await created;
  await expect(shown(page, 'Conversa E2E')).toBeVisible();
  const link = (await shown(page, /\/agenda\/[\w.-]+$/)
    .first()
    .textContent())!.trim();
  const path = new URL(link).pathname;

  // Quem reserva não tem conta
  const guest = await (await browser.newContext()).newPage();
  await guest.goto(path);
  await expect(guest.getByRole('heading', { name: /Agenda de/ })).toBeVisible();
  await guest.getByRole('link', { name: /Conversa E2E · 45 min/ }).click();
  await expect(guest.getByRole('heading', { name: 'Conversa E2E' })).toBeVisible();
  await guest
    .getByRole('radio', { name: /^\d\d:\d\d$/ })
    .first()
    .click();
  await guest.getByRole('textbox', { name: 'Seu nome' }).fill('Bia Visitante');
  await guest.getByRole('textbox', { name: 'Seu e-mail' }).fill('bia@exemplo.com');
  await guest.getByRole('textbox', { name: 'Sobre o que é (opcional)' }).fill('Projeto novo');
  const booked = guest.waitForResponse((r) => r.url().includes('/rpc/book_slot') && r.ok());
  await guest.getByRole('button', { name: 'Confirmar reserva' }).click();
  await booked;
  await expect(guest.getByRole('heading', { name: 'Reserva confirmada' })).toBeVisible();
  await expect(guest.getByRole('button', { name: 'Adicionar à agenda (.ics)' })).toBeVisible();
  const manage = (await guest.getByText(/\/reserva\/[0-9a-f]+$/).textContent())!.trim();

  // Remarcar pelo link: outro horário
  await guest.goto(new URL(manage).pathname);
  await guest.getByRole('button', { name: 'Remarcar' }).click();
  await expect(guest.getByText('Remarcar com', { exact: false })).toBeVisible();
  await guest
    .getByRole('radio', { name: /^\d\d:\d\d$/ })
    .nth(1)
    .click();
  const moved = guest.waitForResponse((r) => r.url().includes('/rpc/reschedule_booking') && r.ok());
  await guest.getByRole('button', { name: 'Remarcar para este horário' }).click();
  await moved;
  await expect(guest.getByRole('heading', { name: 'Reserva confirmada' })).toBeVisible();

  // A dona vê a reserva (vira tarefa) e cancela
  await page.reload();
  await expect(shown(page, /Conversa E2E · Bia Visitante/)).toBeVisible();
  await expect(shown(page, /confirmada · bia@exemplo.com/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  const cancelled = page.waitForResponse((r) => isRpc(r, 'respond_booking'));
  await page.getByRole('button', { name: 'Cancelar reserva' }).click();
  await cancelled;
  await expect(shown(page, 'Reserva cancelada')).toBeVisible();

  await guest.goto(new URL(manage).pathname);
  await expect(guest.getByRole('heading', { name: 'Reserva cancelada' })).toBeVisible();
  await expect(guest.getByText('Quem você reservou cancelou o compromisso.')).toBeVisible();
});

// AG3 (D312): achar horário com outra pessoa do projeto e criar o compromisso com os dois
test('achar horário no projeto e criar o compromisso', async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Duas pessoas: desktop basta');
  test.setTimeout(120_000);
  await signUp(page, testInfo);
  await openTab(page, 'Pastas');
  await page.getByRole('button', { name: 'Usar modelo' }).click();
  await page.getByRole('button', { name: 'Modelo Churrasco' }).click();
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Churrasco' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Pessoas' }).click();
  await page.getByRole('button', { name: 'Gerar link de convite' }).click();
  const link = (await page.getByLabel('Link de convite').textContent()) ?? '';
  await page.getByRole('button', { name: 'Voltar' }).click();

  const greg = await (await browser.newContext({ ...devices['Desktop Chrome'] })).newPage();
  await greg.goto(link);
  await greg.getByPlaceholder('Seu nome').fill('Greg Souza');
  await greg
    .getByPlaceholder('E-mail')
    .fill(`e2e-agenda-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@teste.local`);
  await greg.getByPlaceholder('Senha').fill('senha-forte-123');
  await greg.getByRole('checkbox', { name: /aceito os Termos/ }).click();
  await greg.getByRole('button', { name: 'Criar conta' }).click();
  await greg.getByRole('button', { name: 'Participar' }).click();
  await expect(greg.getByRole('heading', { name: 'Churrasco' })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Achar horário' }).click();
  await expect(page.getByRole('checkbox', { name: 'Greg Souza' })).toBeChecked();
  const searched = page.waitForResponse((r) => isRpc(r, 'group_free_slots'));
  await page.getByRole('button', { name: 'Procurar horários' }).click();
  await searched;
  // Ninguém configurou a semana: os dois aparecem como "sem agenda" e não limitam
  await expect(
    page.getByText(/Sem agenda configurada \(não limitam\): .*Greg Souza/),
  ).toBeVisible();
  await page
    .getByRole('radio', { name: /^\d\d:\d\d$/ })
    .first()
    .click();
  const title = `Reunião E2E ${Date.now()}`;
  await page.getByRole('textbox', { name: 'Nome do compromisso' }).fill(title);
  await page.getByRole('button', { name: 'Criar compromisso' }).click();
  await expect(shown(page, 'Compromisso criado')).toBeVisible();

  // A tarefa entra na lista com horário e os dois como responsáveis
  await page.getByRole('link', { name: 'Compras' }).last().click();
  await expect(page.getByRole('checkbox', { name: `Concluir ${title}` })).toBeVisible();
  await greg.reload();
  await greg.getByRole('link', { name: 'Compras' }).last().click();
  await expect(greg.getByRole('checkbox', { name: `Concluir ${title}` })).toBeVisible({
    timeout: 15_000,
  });
});
