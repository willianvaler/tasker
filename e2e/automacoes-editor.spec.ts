import { expect, test } from '@playwright/test';

import { adminRest, createPage, openSettings, signUp, waitForSync } from './helpers';

// ESCOPO_V14 (AU7): o editor em formulário, só pela tela (celular e desktop), achando cada campo
// pelo rótulo (o mesmo que o leitor de tela lê).

test('editor: modelo, Testar sem efeito e salvar pela tela', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await signUp(page, testInfo);
  await openSettings(page);
  await page.getByRole('button', { name: 'Abrir as automações' }).click();
  await expect(page.getByRole('heading', { name: 'Automações' })).toBeVisible();
  // O uso da hora só aparece perto do limite (avaliação de UX, M11)
  await expect(page.getByText(/Uso desta hora/)).toHaveCount(0);

  await page.getByRole('button', { name: 'Usar "Lembrar das atrasadas às 19:00"' }).click();
  await expect(page.getByRole('textbox', { name: 'Nome' })).toHaveValue(
    'Lembrar das atrasadas às 19:00',
  );
  await expect(page.getByRole('textbox', { name: 'Horário (HH:MM)' })).toHaveValue('19:00');

  // Testar: com o exemplo (nenhuma atrasada), as condições não batem; nada foi gravado
  await page.getByRole('button', { name: 'Testar' }).click();
  await expect(page.getByText('Testar: as condições não batem com o exemplo.')).toBeVisible();

  const saved = page.waitForResponse(
    (r) => r.url().includes('/automation_rules') && r.request().method() === 'POST' && r.ok(),
  );
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await saved;
  await expect(page.getByText('Automação salva.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Executar agora' })).toBeVisible();
  await expect(page.getByText('Ainda não rodou.')).toBeVisible();
});

test('editor: regra do zero pela tela dispara ao concluir e mostra o histórico', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop',
    'o fluxo de criar pela tela já roda no celular no teste acima',
  );
  test.setTimeout(150_000);
  await signUp(page, testInfo);
  const pageId = await createPage(page, {
    folder: `Casa ${Date.now()}`,
    name: 'Faxina',
    type: 'Lista',
  });
  await page.goto('/automacao/nova');
  await page.getByRole('textbox', { name: 'Nome' }).fill('Avisar ao concluir');
  await page.getByRole('radio', { name: 'Tarefa concluída' }).click();
  // Condição: o título contém "varrer"
  await page.getByRole('button', { name: 'Adicionar condição' }).click();
  await page.getByRole('radio', { name: 'Comparar um valor' }).click();
  await page.getByRole('textbox', { name: 'Comparar com' }).fill('varrer');
  // O passo de aviso que já vem
  await page.getByRole('textbox', { name: 'Texto' }).fill('Feita: {{evento.titulo|corta:12}}');
  await page.getByRole('radio', { name: 'Só no app' }).click();
  // Mais um passo: pôr etiqueta na tarefa
  await page.getByRole('radio', { name: 'Mudar a tarefa' }).click();
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await page.getByRole('textbox', { name: 'Pôr etiquetas (separadas por vírgula)' }).fill('motor');

  await page.getByRole('button', { name: 'Testar' }).click();
  await expect(page.getByText('Testar: as condições não batem com o exemplo.')).toBeVisible();

  const saved = page.waitForResponse(
    (r) => r.url().includes('/automation_rules') && r.request().method() === 'POST' && r.ok(),
  );
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await saved;
  await expect(page.getByText('Automação salva.')).toBeVisible();

  // Concluir pela tela: o aviso chega e o histórico mostra a execução
  await page.goto(`/page/${pageId}`);
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  const created = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  await input.fill('Varrer a sala inteira');
  await input.press('Enter');
  await created;
  await page.getByRole('checkbox', { name: 'Concluir Varrer a sala inteira' }).click();
  await waitForSync(page);
  const [task] = await adminRest(`tasks?page_id=eq.${pageId}&select=labels`);
  await expect
    .poll(async () => (await adminRest(`tasks?page_id=eq.${pageId}&select=labels`))[0].labels, {
      timeout: 30_000,
    })
    .toEqual(['motor']);
  expect(task).toBeDefined();
  await page.goto('/notifications');
  await expect(page.getByText('Feita: Varrer a sal', { exact: true })).toBeVisible({
    timeout: 15_000,
  });

  await page.goto('/automacoes');
  await page.getByRole('button', { name: 'Editar Avisar ao concluir' }).click();
  await expect(page.getByRole('button', { name: /· feito$/ })).toBeVisible({ timeout: 15_000 });
});
