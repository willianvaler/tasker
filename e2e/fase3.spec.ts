import { expect, test } from '@playwright/test';

import { ageTask, openTab, signUp } from './helpers';

test('critério de aceite: concluir e desmarcar mudam XP e HP do boss, e voltam', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  // Cartão do topo da tela Hoje (no desktop, a barra lateral também mostra o XP)
  const game = page.getByRole('link', { name: 'Nível, XP e boss da semana' });
  // Nível 1: boss com 100 + 15 × 1 de HP
  await expect(game.getByText('0/100 XP')).toBeVisible();
  await expect(game.getByText(/115\/115 HP/)).toBeVisible();

  // Título único: o ageTask acha a tarefa pelo título, e o banco é compartilhado entre os testes
  const title = `Pagar conta ${testInfo.project.name} ${Date.now()}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  const created = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  await input.fill(title);
  await input.press('Enter');
  await created;
  await ageTask(title);

  const done = page.waitForResponse((r) => r.url().includes('/complete_task') && r.ok());
  await page.getByRole('checkbox', { name: `Concluir ${title}` }).click();
  await done;
  await expect(page.getByText(`Concluída: ${title} · +10 XP · 🌱 Primeiro passo`)).toBeVisible();
  await expect(game.getByText('10/100 XP')).toBeVisible();
  await expect(game.getByText(/105\/115 HP/)).toBeVisible();

  const undone = page.waitForResponse((r) => r.url().includes('uncomplete_task') && r.ok());
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await undone;
  await expect(game.getByText('0/100 XP')).toBeVisible();
  await expect(game.getByText(/115\/115 HP/)).toBeVisible();

  // Marcar de novo: o saldo é sempre o de uma conclusão só
  const again = page.waitForResponse((r) => r.url().includes('/complete_task') && r.ok());
  await page.getByRole('checkbox', { name: `Concluir ${title}` }).click();
  await again;
  await expect(game.getByText('10/100 XP')).toBeVisible();

  // Perfil: conquista e desligar a gamificação
  await openTab(page, 'Perfil');
  await expect(page.getByLabel('Primeiro passo: Concluir a primeira tarefa')).toBeVisible();
  await expect(page.getByLabel('Centena: 100 tarefas concluídas (bloqueada)')).toBeVisible();
  const saved = page.waitForResponse((r) => r.url().includes('/profiles') && r.ok());
  await page.getByRole('switch', { name: 'Gamificação' }).click();
  await saved;
  await openTab(page, 'Hoje');
  await expect(page.getByRole('heading', { name: /^Hoje/ })).toBeVisible();
  await expect(game).toHaveCount(0);
  await expect(page.getByText('10/100 XP')).toHaveCount(0);
});
