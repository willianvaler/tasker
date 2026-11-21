import { expect, test } from '@playwright/test';

import { openTab, shown, signUp } from './helpers';

// GP3 (D315): marco no projeto, tarefa ligada pela escrita rápida (~marco), o Roadmap com o
// progresso e o painel da tarefa com o marco escolhido.

test('roadmap: ~marco na escrita rápida, progresso e notas da versão', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const name = `Lançamento ${Date.now()}`;
  await signUp(page, testInfo);
  await openTab(page, 'Pastas');
  await page.getByRole('button', { name: 'Usar modelo' }).click();
  await page.getByRole('button', { name: 'Kit Reforma' }).click();
  await page.getByPlaceholder('Nome').fill(name);
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 });

  const milestone = page.getByRole('textbox', { name: 'Novo marco (ex.: Compras sexta)' });
  await milestone.fill('Entrega sexta');
  await milestone.press('Enter');
  await expect(page.getByRole('button', { name: 'Roadmap' })).toBeVisible({ timeout: 15_000 });

  // Na lista Etapas do projeto, uma tarefa ligada ao marco pela escrita rápida
  await page.getByRole('link', { name: /^Etapas Tarefas/ }).click();
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Comprar o piso ~Entrega');
  await input.press('Enter');
  await expect(page.getByRole('checkbox', { name: 'Concluir Comprar o piso' })).toBeVisible();

  // O painel mostra o marco escolhido
  await page.getByRole('button', { name: 'Detalhes de Comprar o piso' }).click();
  await expect(page.getByRole('radio', { name: /^Entrega · / })).toBeChecked({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Voltar' }).first().click();
  await page.getByRole('button', { name: 'Voltar' }).first().click();

  await page.getByRole('button', { name: 'Roadmap' }).click();
  await expect(page.getByRole('heading', { name: 'Roadmap' })).toBeVisible();
  const region = page.getByRole('region', { name: 'Entrega' });
  await expect(region.getByText('0 de 1 feitas')).toBeVisible({ timeout: 15_000 });
  await expect(region.getByRole('link', { name: /Comprar o piso/ })).toBeVisible();

  // Concluir o marco oferece as notas da versão (anotação gerada)
  await region.getByRole('button', { name: 'Concluir o marco' }).click();
  await region.getByRole('button', { name: 'Notas da versão' }).click();
  await expect(shown(page, 'Notas da versão criadas')).toBeVisible({ timeout: 15_000 });
  await expect(shown(page, /Ficou para depois/).first()).toBeVisible();
});
