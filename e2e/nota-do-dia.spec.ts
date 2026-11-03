import { expect, test } from '@playwright/test';

import { openTab, signUp } from './helpers';

// OB5 (ESCOPO_V11 §4, D290): modelo da nota do dia, nota do dia pela Hoje (e Alt+D), diário
// automático com o que foi concluído e criado no dia, e o ponto no Calendário.
test('anotações: nota do dia, modelo e diário', async ({ page }, testInfo) => {
  const desktop = testInfo.project.name === 'desktop';
  const stamp = `${testInfo.project.name}${Date.now()}`;
  await signUp(page, testInfo);

  // Uma tarefa criada e concluída hoje, outra só criada
  await openTab(page, 'Caixa de entrada');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(`Feita ${stamp}`);
  await input.press('Enter');
  await input.fill(`Aberta ${stamp}`);
  await input.press('Enter');
  await page.getByRole('checkbox', { name: `Concluir Feita ${stamp}` }).click();
  await page.waitForResponse((r) => r.url().includes('/rpc/complete_task'));

  // Modelo da nota do dia
  await page.goto('/notas');
  await page.getByRole('button', { name: 'Novo modelo' }).click();
  await expect(page.getByTestId('template-banner')).toBeVisible();
  await page.getByRole('textbox', { name: 'Texto da anotação' }).fill('## Diário {{data}}\n\nHumor:');
  await page.getByRole('button', { name: 'Mais opções da anotação' }).click();
  await page.getByRole('menuitem', { name: 'Usar na nota do dia' }).click();
  await expect(page.getByTestId('template-banner')).toContainText('modelo da nota do dia');
  await page.getByRole('button', { name: 'Visualizar' }).click();
  await page.waitForTimeout(1200);

  // O modelo não aparece entre as anotações, só em Modelos
  await page.goto('/notas');
  await expect(
    page.getByRole('list', { name: 'Modelos' }).getByRole('link', { name: /Modelo novo/ }),
  ).toBeVisible();

  // Nota do dia pela Hoje: título do dia, texto do modelo e o diário embaixo
  await page.goto('/');
  await page.getByRole('button', { name: 'Nota do dia' }).first().click();
  const title = page.getByRole('textbox', { name: 'Título da anotação' });
  await expect(title).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  const day = await title.inputValue();
  await expect(page.getByText(`Diário ${day}`, { exact: true }).last()).toBeVisible();
  const journal = page.getByTestId('daily-journal').last();
  await expect(
    journal.getByRole('list', { name: 'Concluídas neste dia' }).getByText(`Feita ${stamp}`),
  ).toBeVisible();
  await expect(
    journal.getByRole('list', { name: 'Criadas neste dia' }).getByText(`Aberta ${stamp}`),
  ).toBeVisible();
  const url = page.url();

  // De novo abre a mesma (não cria outra); no computador, pelo Alt+D
  await page.goto('/');
  if (desktop) {
    // Atalho com Alt não vale enquanto se digita: tira o foco do campo de captura
    await page.getByRole('heading', { name: 'Hoje' }).first().click();
    await page.keyboard.press('Alt+d');
  }
  else await page.getByRole('button', { name: 'Nota do dia' }).first().click();
  await expect(page).toHaveURL(url);

  // Calendário: o dia tem ponto e a nota abre pela lista do dia
  await page.goto('/calendario');
  await expect(page.getByTestId(`note-dot-${day}`)).toBeVisible();
  await page.getByRole('button', { name: 'Nota do dia', exact: true }).last().click();
  await expect(page).toHaveURL(url);
});
