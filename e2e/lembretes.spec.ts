import { expect, test } from '@playwright/test';

import { shown, signUp } from './helpers';

// D206: horário na captura rápida, na linha e no painel, com o lembrete
test('horário e lembrete de tarefa', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  const title = `Ligar banco ${Date.now()}`;
  const input = page.getByPlaceholder('Nova tarefa para hoje…').first();
  const created = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  await input.fill(`${title} às 23h`);
  await input.press('Enter');
  await created;
  // A linha mostra a hora e o sino do lembrete (padrão: na hora)
  await expect(shown(page, /Hoje 23:00 🔔/).first()).toBeVisible();

  await page.getByRole('button', { name: `Detalhes de ${title}` }).first().click();
  await expect(page.getByRole('radio', { name: 'Na hora' })).toHaveAttribute('aria-checked', 'true');
  const saved = page.waitForResponse((r) => r.url().includes('/rest/v1/tasks') && r.ok());
  await page.getByRole('radio', { name: '15 min antes' }).click();
  await saved;
  await expect(page.getByRole('radio', { name: '15 min antes' })).toHaveAttribute('aria-checked', 'true');
});
