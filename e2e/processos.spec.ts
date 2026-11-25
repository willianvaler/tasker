import { expect, test, type Page } from '@playwright/test';

import { adminRest, signUp } from './helpers';

// ESCOPO_V16 (PR5, PR6, PR8): processo pela tela, do modelo à conclusão, e o editor por teclado.
// Precisa do executor ligado no Supabase local (`app_config.automation_url`, D334).

const userIdOf = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    return JSON.parse(localStorage.getItem(key ?? '') ?? '{}').user?.id as string;
  });

test('aprovação: modelo, publicar, iniciar, responder e concluir', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'o editor de diagrama é da web larga');
  test.setTimeout(180_000);
  await signUp(page, testInfo);
  const uid = await userIdOf(page);
  await page.goto('/processos');
  await expect(page.getByRole('heading', { name: 'Processos' })).toBeVisible();
  await page.getByRole('button', { name: 'Usar "Aprovação"' }).click();
  await expect(page.getByRole('heading', { name: 'Aprovação' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Sem erros')).toBeVisible();

  // Simular antes: o caminho do "Aprovar" sem fazer nada de verdade
  await page.getByRole('button', { name: 'Simular (sem fazer nada de verdade)' }).click();
  await expect(page.getByText('Simulação: o processo chegou ao fim.')).toBeVisible();

  await page.getByRole('button', { name: 'Publicar a versão 1' }).click();
  await expect(page.getByText(/Publicado: o que já está rodando/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Iniciar agora' }).click();
  await expect(page).toHaveURL(/\/processos\/instancia\//, { timeout: 15_000 });

  // O executor cria a tarefa humana na Caixa de entrada
  await expect
    .poll(
      async () =>
        (await adminRest(`tasks?created_by=eq.${uid}&title=eq.Aprovar o pedido&select=id`)).length,
      { timeout: 30_000 },
    )
    .toBe(1);
  const [tarefa] = await adminRest(
    `tasks?created_by=eq.${uid}&title=eq.Aprovar o pedido&select=id,meta`,
  );
  expect(tarefa.meta.processo.escolhas).toEqual(['Aprovar', 'Rejeitar']);
  await page.goto(`/task/${tarefa.id}`);
  await expect(page.getByText('Tarefa do processo Aprovação')).toBeVisible({ timeout: 15_000 });
  const respondeu = page.waitForResponse(
    (r) => r.url().includes('process_complete_task') && r.ok(),
  );
  await page.getByRole('button', { name: 'Aprovar', exact: true }).click();
  await respondeu;

  await expect
    .poll(
      async () =>
        (await adminRest(`process_instances?owner_id=eq.${uid}&select=status`))[0]?.status,
      { timeout: 30_000 },
    )
    .toBe('concluida');
  const avisos = await adminRest(
    `notifications?user_id=eq.${uid}&kind=eq.automation&select=payload`,
  );
  expect(avisos.map((n: { payload: { message: string } }) => n.payload.message)).toContain(
    'Pedido aprovado.',
  );
  // Sem XP para a tarefa do processo (V16-13)
  expect(
    await adminRest(`xp_events?user_id=eq.${uid}&task_id=eq.${tarefa.id}&select=id`),
  ).toHaveLength(0);
});

test('editor: criar e ligar passos sem o mouse, com a validação ao vivo', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'o editor de diagrama é da web larga');
  test.setTimeout(120_000);
  await signUp(page, testInfo);
  await page.goto('/processos');
  await page.getByRole('button', { name: 'Novo processo' }).click();
  await expect(page.getByRole('heading', { name: 'Processo novo' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('Sem erros')).toBeVisible();

  // Um passo automático solto: a validação aponta
  await page.getByRole('button', { name: '+ Passo automático' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/nunca é alcançado a partir do início/)).toBeVisible();

  // Ligar pelo formulário (o mesmo que o teclado e o leitor de tela usam)
  const de = page.getByRole('radiogroup', { name: 'De' });
  const para = page.getByRole('radiogroup', { name: 'Para' });
  await de.getByRole('radio', { name: 'Início' }).click();
  await para.getByRole('radio', { name: 'Passo automático' }).click();
  await page.getByRole('button', { name: 'Ligar', exact: true }).click();
  await de.getByRole('radio', { name: 'Passo automático' }).click();
  await para.getByRole('radio', { name: 'Fim' }).click();
  await page.getByRole('button', { name: 'Ligar', exact: true }).click();
  await expect(page.getByText('Sem erros')).toBeVisible();

  // Desfazer volta para o erro
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(
    page.getByText(/não tem caminho até um fim|não leva a lugar nenhum/).first(),
  ).toBeVisible();
});
