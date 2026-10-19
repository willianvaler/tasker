import { expect, test } from '@playwright/test';

import { ageTask, openTab, signUp, isRpc } from './helpers';

test('critério de aceite: concluir e desmarcar mudam XP e HP do boss, e voltam', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  // Cartão do topo da tela Hoje no celular; coluna da direita no desktop (a barra lateral também
  // mostra o XP)
  const game = page
    .getByRole('link', { name: 'Personagem, nível, XP e boss da semana' })
    .or(page.getByLabel('Personagem e boss da semana'));
  // Boss de nível 1: 300 de HP (O2)
  await expect(game.getByText('0/100 XP')).toBeVisible();
  await expect(game.getByText(/300\/300 HP/)).toBeVisible();

  // Título único: o ageTask acha a tarefa pelo título, e o banco é compartilhado entre os testes
  const title = `Pagar conta ${testInfo.project.name} ${Date.now()}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  const created = page.waitForResponse((r) => r.url().includes('create_tasks_batch') && r.ok());
  await input.fill(title);
  await input.press('Enter');
  await created;
  await ageTask(title);

  const done = page.waitForResponse((r) => isRpc(r, 'complete_task'));
  await page.getByRole('checkbox', { name: `Concluir ${title}` }).click();
  await done;
  // Sem classe: 10 × 1,05 = 11 de dano (21 num crítico, O2), 2 de ouro (D61)
  await expect(
    page.getByText(
      new RegExp(`Concluída: ${title} · \\+10 XP · (⚔️ 11|💥 21) de dano.* · 🌱 Primeiro passo`),
    ),
  ).toBeVisible();
  await expect(game.getByText('10/100 XP')).toBeVisible();
  await expect(game.getByText(/(289|279)\/300 HP/)).toBeVisible();

  const undone = page.waitForResponse((r) => isRpc(r, 'uncomplete_task'));
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await undone;
  await expect(game.getByText('0/100 XP')).toBeVisible();
  await expect(game.getByText(/300\/300 HP/)).toBeVisible();

  // Marcar de novo: o saldo é sempre o de uma conclusão só
  const again = page.waitForResponse((r) => isRpc(r, 'complete_task'));
  await page.getByRole('checkbox', { name: `Concluir ${title}` }).click();
  await again;
  await expect(game.getByText('10/100 XP')).toBeVisible();

  // Perfil: conquista e desligar a gamificação
  await openTab(page, 'Perfil');
  await expect(page.getByLabel('Primeiro passo: Concluir a primeira tarefa')).toBeVisible();
  // O Perfil mostra as recentes; todas (com as que faltam) ficam na tela de conquistas (P3)
  await expect(page.getByRole('button', { name: 'Ver todas as conquistas' })).toBeVisible();
  const saved = page.waitForResponse((r) => r.url().includes('/profiles') && r.ok());
  await page
    .getByRole('radiogroup', { name: 'Gamificação' })
    .getByRole('radio', { name: 'Desligado' })
    .click();
  await saved;
  await openTab(page, 'Hoje');
  await expect(page.getByRole('heading', { name: /^Hoje/ })).toBeVisible();
  await expect(game).toHaveCount(0);
  await expect(page.getByText('10/100 XP')).toHaveCount(0);
});
