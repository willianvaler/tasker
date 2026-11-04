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
