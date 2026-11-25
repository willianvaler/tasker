import { expect, test } from '@playwright/test';

import { openTab, signUp, waitForSync } from './helpers';

// PB8 (V3 §6 B, D303): o que chega pelo "Compartilhar" (na web instalada, o share_target abre
// /compartilhar?title=&text=&url=; no Android, o módulo share-intent abre a mesma tela).
test('compartilhar: link vira tarefa com a descrição; lista vira várias', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  const stamp = Date.now();
  await page.goto(
    `/compartilhar?title=${encodeURIComponent(`Receita ${stamp}`)}&text=${encodeURIComponent(
      `Bolo de cenoura https://exemplo.com/bolo-${stamp}`,
    )}`,
  );
  await expect(page.getByText('Recebido de outro app')).toBeVisible();
  await expect(page.getByTestId('shared-url')).toHaveText(`https://exemplo.com/bolo-${stamp}`);
  await page.getByRole('button', { name: 'Criar uma tarefa' }).click();
  await expect(page.getByRole('textbox', { name: 'Título' })).toHaveValue(`Receita ${stamp}`);
  await expect(page.getByRole('textbox', { name: 'Descrição' })).toHaveValue(
    `Bolo de cenoura\nhttps://exemplo.com/bolo-${stamp}`,
  );
  // Recarregar logo depois cancela o envio: espera a tarefa e a descrição subirem
  await page.getByRole('button', { name: 'Criar tarefa' }).click();
  await expect(page.getByText(/Tarefa criada em Caixa de entrada/)).toBeVisible();
  await waitForSync(page);

  // Texto com várias linhas: uma tarefa por linha, conferindo no lote
  await page.goto(`/compartilhar?text=${encodeURIComponent(`Mercado ${stamp}\nleite\novos`)}`);
  await page.getByRole('button', { name: '3 tarefas, uma por linha' }).click();
  await expect(page.getByRole('textbox', { name: 'Lista de tarefas' })).toHaveValue(
    `Mercado ${stamp}\nleite\novos`,
  );
  await page.getByRole('button', { name: 'Criar 3' }).click();
  await openTab(page, 'Caixa de entrada');
  await expect(page.getByRole('checkbox', { name: `Concluir Mercado ${stamp}` })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: `Concluir Receita ${stamp}` })).toBeVisible();
});

// CP1 (ESCOPO_V15 §7, D366): imagem ou PDF que chega pelo Compartilhar vira anexo da tarefa, na
// lista escolhida; PDF acima do limite é recusado com o motivo. Na web a cópia é um data:, no
// Android o file:// do cache do app.
test('compartilhar: imagem vira anexo; PDF grande demais é recusado', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  const stamp = Date.now();
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const big = 12 * 1024 * 1024;
  await page.goto(
    `/compartilhar?fileUri=x&fileName=${encodeURIComponent('Manual.pdf')}&fileMime=application/pdf&fileSize=${big}`,
  );
  await expect(page.getByText(/passa de 10 MB/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nova tarefa com o anexo' })).toBeDisabled();

  await page.goto(
    `/compartilhar?fileUri=${encodeURIComponent(png)}&fileName=${encodeURIComponent(
      `Recibo ${stamp}.png`,
    )}&fileMime=image/png&fileSize=70`,
  );
  await expect(page.getByText(`Recibo ${stamp}.png`, { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Nova tarefa com o anexo' }).click();
  await expect(page.getByRole('textbox', { name: 'Título' })).toHaveValue(`Recibo ${stamp}`);
  await expect(page.getByText(`Anexo: Recibo ${stamp}.png`)).toBeVisible();
  await page.getByRole('button', { name: 'Criar tarefa' }).click();
  await expect(page.getByText(`Recibo ${stamp}.png anexado à tarefa.`)).toBeVisible({ timeout: 30_000 });
});
