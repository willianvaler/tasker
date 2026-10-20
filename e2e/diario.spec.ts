import { expect, test } from '@playwright/test';

import { adminRest, openTab, shown, signUp } from './helpers';

// AC4 (D236): o Modo Treino grava cada série como aconteceu (repetições reais, esforço,
// aquecimento à parte) e o painel do exercício mostra o histórico.
test('diário: série real, esforço e aquecimento no histórico', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'O Modo Treino é o mesmo; basta um perfil');
  await signUp(page, testInfo);
  await openTab(page, 'Início');
  await page.getByRole('button', { name: 'Sim, vou treinar' }).click();

  // Esforço por série ligado no Perfil (RPE)
  await openTab(page, 'Perfil');
  await page.getByRole('radio', { name: 'RPE' }).click();
  await expect(page.getByRole('radio', { name: 'RPE' })).toHaveAttribute('aria-checked', 'true');
  await openTab(page, 'Início');

  await page.getByRole('navigation').getByRole('button', { name: 'Novo treino' }).first().click();
  const name = `Treino ${Date.now()}`;
  await page.getByPlaceholder('Nome do treino (ex.: Treino A)').fill(name);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Supino 2x10 40kg');
  await input.press('Enter');
  await expect(page.getByRole('button', { name: 'Detalhes de Supino' })).toBeVisible();

  await page.getByRole('button', { name: 'Iniciar treino' }).click();
  await expect(page.getByRole('heading', { name: 'Supino' })).toBeVisible();

  // Aquecimento: fica no diário e não conta série
  await page.getByRole('button', { name: 'Aquecimento' }).click();
  await expect(shown(page, 'Aquecimento registrado')).toBeVisible();
  await expect(shown(page, 'Série 1 de 2')).toBeVisible();

  // Primeira série com uma repetição a menos e RPE 8
  await page.getByRole('button', { name: 'Menos uma repetição' }).click();
  await expect(page.getByLabel('Repetições feitas: 9')).toBeVisible();
  await page.getByRole('radio', { name: '8', exact: true }).click();
  await page.getByRole('button', { name: 'Feita' }).click();
  await expect(shown(page, 'Série 2 de 2')).toBeVisible();
  // A próxima série volta ao previsto
  await expect(page.getByLabel('Repetições feitas: 10')).toBeVisible();
  await page.getByRole('button', { name: 'Feita' }).click();

  await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Detalhes de Supino' }).click();
  await expect(shown(page, /2 séries · Volume 760 kg/)).toBeVisible({ timeout: 15_000 });
  await expect(shown(page, '40 kg × 9 · RPE 8')).toBeVisible();
  await expect(shown(page, /^40 kg × 10$/)).toBeVisible();
  await expect(shown(page, /40 kg × 10 · aquecimento/)).toBeVisible();

  // Apagar uma série do diário
  await page.getByRole('button', { name: 'Apagar série' }).first().click();
  await page.getByRole('button', { name: 'Apagar série' }).last().click();
  await expect(shown(page, /40 kg × 10 · aquecimento/)).toHaveCount(0);
});

// AC5 (D237): série mais pesada que as anteriores avisa o recorde; o resumo conta e o painel
// mostra os melhores, com o 1RM e de que série ele veio
test('recorde no Modo Treino, no resumo e no painel', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'O Modo Treino é o mesmo; basta um perfil');
  await signUp(page, testInfo);
  await openTab(page, 'Início');
  await page.getByRole('button', { name: 'Sim, vou treinar' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Novo treino' }).first().click();
  const name = `Treino ${Date.now()}`;
  await page.getByPlaceholder('Nome do treino (ex.: Treino A)').fill(name);
  await page.getByRole('button', { name: 'Salvar' }).click();
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Agachamento 2x10 40kg');
  await input.press('Enter');
  await expect(page.getByRole('button', { name: 'Detalhes de Agachamento' })).toBeVisible();

  await page.getByRole('button', { name: 'Iniciar treino' }).click();
  // A primeira série é o ponto de partida: sem recorde
  await page.getByRole('button', { name: 'Feita' }).click();
  await expect(shown(page, 'Série 2 de 2')).toBeVisible();
  await expect(shown(page, /^Recorde!/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Aumentar a carga' }).click();
  await expect(page.getByLabel('Carga: 42,5kg')).toBeVisible();
  // Última série: o aviso do recorde dá lugar ao resumo do treino, que conta o recorde
  await page.getByRole('button', { name: 'Feita' }).click();
  await expect(shown(page, /Treino concluído · .*1 recorde/)).toBeVisible();

  await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Detalhes de Agachamento' }).click();
  await expect(shown(page, 'Maior 1RM estimado', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(shown(page, /pela série 42,5 kg × 10/)).toBeVisible();
});

// AC6 (D238): a carga do próximo treino sai do diário: linear, fez tudo ontem → sobe um degrau
// sozinha no treino pessoal e diz por quê
test('progressão: a carga sobe sozinha e diz por quê', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'O Modo Treino é o mesmo; basta um perfil');
  await signUp(page, testInfo);
  await openTab(page, 'Início');
  await page.getByRole('button', { name: 'Sim, vou treinar' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Novo treino' }).first().click();
  const name = `Treino ${Date.now()}`;
  await page.getByPlaceholder('Nome do treino (ex.: Treino A)').fill(name);
  await page.getByRole('button', { name: 'Salvar' }).click();
  const title = `Remada ${Date.now()}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(`${title} 2x10 40kg`);
  await input.press('Enter');
  await page.getByRole('button', { name: `Detalhes de ${title}` }).click();
  await page.getByRole('radio', { name: 'Linear' }).click();
  await expect(page.getByRole('radio', { name: 'Linear' })).toHaveAttribute('aria-checked', 'true');

  // Ontem: 2×10 com 40 kg, tudo feito
  const [task] = await expect
    .poll(
      async () =>
        adminRest(
          `tasks?title=eq.${encodeURIComponent(title)}&progression=eq.linear&select=id,created_by,page_id`,
        ),
      {
        timeout: 15_000,
      },
    )
    .toHaveLength(1)
    .then(() =>
      adminRest(`tasks?title=eq.${encodeURIComponent(title)}&select=id,created_by,page_id`),
    );
  const yesterday = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
  await adminRest('workout_sets', {
    method: 'POST',
    body: JSON.stringify(
      [1, 2].map((i) => ({
        user_id: task.created_by,
        task_id: task.id,
        page_id: task.page_id,
        exercise_name: title,
        set_index: i,
        weight_kg: 40,
        reps: 10,
        target_reps: 10,
        target_sets: 2,
        performed_at: yesterday,
      })),
    ),
  });
  // Dado que chegou de fora (como de outro aparelho): o painel lê de novo ao abrir
  await page.reload();
  await expect(shown(page, 'Próximo: 42,5 kg · 10 reps')).toBeVisible({ timeout: 20_000 });
  await expect(shown(page, 'Subiu 2,5 kg: fez 2×10 na última')).toBeVisible();

  await page.goto(`/page/${task.page_id}`);
  await page.getByRole('button', { name: 'Iniciar treino' }).click();
  await expect(page.getByLabel('Carga: 42,5kg')).toBeVisible({ timeout: 15_000 });
  await expect(shown(page, 'Subiu 2,5 kg: fez 2×10 na última')).toBeVisible();
});
