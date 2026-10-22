import { expect, test } from '@playwright/test';

import { openSettings, openTab, signUp } from './helpers';

// UX11 (D265): o painel mostra o que a tarefa usa; o resto entra pelo "+ Adicionar". "Mostrar todas
// as seções" (Configurações) abre tudo. Sem o storageState da configuração (que liga o "todas")
test.use({ storageState: { cookies: [], origins: [] } });

test('painel da tarefa: o que a tarefa usa, + Adicionar e mostrar todas', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  const title = `Painel ${testInfo.project.name} ${Date.now()}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  // Espera a tarefa subir: a releitura depois do envio redesenha o painel e fecharia o menu
  const created = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  await input.fill(title);
  await input.press('Enter');
  await created;
  await page.getByRole('button', { name: `Detalhes de ${title}` }).click();

  // O essencial, sem tempo nem peso; subtarefas e vencimento à vista
  await expect(page.getByRole('button', { name: 'Adicionar descrição' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Nova subtarefa' })).toBeVisible();
  await expect(page.getByText('Peso', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Estimativa' })).toHaveCount(0);

  // + Adicionar → Tempo: a seção aparece e sai do menu
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Tempo' }).click();
  await expect(page.getByRole('textbox', { name: 'Estimativa' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Estimativa' }).fill('45min');
  await page.getByRole('textbox', { name: 'Estimativa' }).press('Enter');

  // Reabrir: a estimativa que a tarefa já tem continua à vista; o peso, não
  await page.getByRole('button', { name: 'Voltar' }).first().click();
  await page.getByRole('button', { name: `Detalhes de ${title}` }).click();
  await expect(page.getByRole('textbox', { name: 'Estimativa' })).toBeVisible();
  await expect(page.getByText('Peso', { exact: true })).toHaveCount(0);

  // Mostrar todas as seções (Configurações → Aparência): o peso aparece
  await page.getByRole('button', { name: 'Voltar' }).first().click();
  await openSettings(page);
  await page.getByRole('switch', { name: 'Mostrar todas as seções do painel da tarefa' }).click();
  await openTab(page, 'Caixa de entrada');
  await page.getByRole('button', { name: `Detalhes de ${title}` }).click();
  await expect(page.getByText('Peso', { exact: true })).toBeVisible();
});
