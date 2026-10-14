import { expect, test } from '@playwright/test';

import { adminRest, signUp } from './helpers';

// Protótipo do sync (D0): banco local na web, escrita offline pela fila até as RPCs, mudança do
// servidor chegando sozinha e acesso revogado tirando os dados do aparelho.
// Precisa do PowerSync local (npm run sync:start).
test.beforeAll(async () => {
  const up = await fetch('http://localhost:8095/probes/liveness').then(
    (r) => r.ok,
    () => false,
  );
  test.skip(!up, 'PowerSync local fora do ar (npm run sync:start)');
});

const serverTask = async (title: string) =>
  (await adminRest(`tasks?title=eq.${encodeURIComponent(title)}&select=id,status,folder_id`))[0];

test('sync: offline, fila, servidor e revogação', async ({ page, context }, testInfo) => {
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  await page.goto('/sync');
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/No aparelho: \d+ pastas, [1-9]\d* páginas/)).toBeVisible();

  // Cria no banco local; a fila leva até o create_tasks_batch
  const title = `Sync ${testInfo.project.name} ${Date.now()}`;
  const field = page.getByPlaceholder('Nova tarefa na Caixa de entrada');
  await field.fill(title);
  await field.press('Enter');
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByText('0 alterações esperando envio')).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => (await serverTask(title))?.status).toBe('todo');

  // Sem conexão: conclui no aparelho, fica na fila; volta a conexão e o complete_task roda
  await context.setOffline(true);
  await page.getByRole('checkbox', { name: title }).click();
  await expect(page.getByRole('checkbox', { name: title })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('1 alterações esperando envio')).toBeVisible();
  expect((await serverTask(title)).status).toBe('todo');
  await context.setOffline(false);
  await expect
    .poll(async () => (await serverTask(title))?.status, { timeout: 30_000 })
    .toBe('done');
  await expect(page.getByText('0 alterações esperando envio')).toBeVisible({ timeout: 15_000 });

  // Mudança feita no servidor chega sem recarregar
  const { id, folder_id } = await serverTask(title);
  await adminRest(`tasks?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title: `${title} (servidor)` }),
  });
  await expect(page.getByText(`${title} (servidor)`)).toBeVisible({ timeout: 15_000 });

  // Sem a participação na pasta, os dados dela somem do aparelho
  await adminRest(`folder_members?folder_id=eq.${folder_id}`, { method: 'DELETE' });
  await expect(page.getByText(`${title} (servidor)`)).toHaveCount(0, { timeout: 15_000 });
});
