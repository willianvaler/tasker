import { expect, test, type Page } from '@playwright/test';

import { adminRest, createPage, openTab, shown, signUp, waitForSync } from './helpers';

// Bateria de usabilidade do Modo Treino (relatos do dono em 19/10): descanso entre exercícios,
// sair para a lista e voltar continua (também em grupo de treino), não trava num exercício já
// feito nem com o treino pausado, e séries avançadas ("1 de 14, 2 de 10, 1 de 8").

async function workoutPage(page: Page, testInfo: Parameters<typeof signUp>[1], lines: string[]) {
  await signUp(page, testInfo);
  const pageId = await createPage(page, { folder: 'Academia', name: 'Treino A', type: 'Cards' });
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  for (const line of lines) {
    await input.fill(line);
    await input.press('Enter');
  }
  const last = lines[lines.length - 1].split(' ')[0];
  await expect(page.getByRole('checkbox', { name: last }).first()).toBeVisible();
  return pageId;
}

const restTimer = (page: Page) => page.getByRole('timer', { name: /^Descanso: faltam/ });

test('descanso entre um exercício e o próximo', async ({ page }, testInfo) => {
  await workoutPage(page, testInfo, ['Supino 2x10 40kg', 'Rosca 2x12 10kg']);
  await page.getByRole('button', { name: 'Iniciar treino' }).click();
  await expect(page.getByRole('heading', { name: 'Supino' })).toBeVisible();

  // Entre séries: descanso (já existia)
  await page.getByRole('button', { name: 'Feita' }).click();
  await expect(restTimer(page)).toBeVisible();
  await page.getByRole('button', { name: 'Pular descanso (R)' }).click();
  await expect(restTimer(page)).toHaveCount(0);

  // Última série do Supino: passa para a Rosca e o descanso começa antes dela (faltava)
  await page.getByRole('button', { name: 'Feita' }).click();
  await expect(page.getByRole('heading', { name: 'Rosca' })).toBeVisible();
  await expect(restTimer(page)).toBeVisible();
  await expect(shown(page, 'Série 1 de 2')).toBeVisible();
});

test('sair para a lista e voltar continua o treino', async ({ page }, testInfo) => {
  await workoutPage(page, testInfo, ['Supino 3x10 40kg', 'Rosca 2x12 10kg']);
  await page.getByRole('button', { name: 'Iniciar treino' }).click();
  await page.getByRole('button', { name: 'Feita' }).click();
  await expect(shown(page, 'Série 2 de 3')).toBeVisible();

  await page.getByRole('button', { name: 'Sair do treino (o andamento fica guardado)' }).click();
  // A página avisa que há treino começado
  await page.getByRole('button', { name: 'Continuar treino' }).click();
  await expect(page.getByRole('heading', { name: 'Supino' })).toBeVisible();
  await expect(shown(page, 'Série 2 de 3')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: '1 de 5 séries' })).toBeVisible();

  // Recarregar (o app fechado e aberto de novo) também continua
  await page.reload();
  await expect(shown(page, 'Série 2 de 3')).toBeVisible({ timeout: 20_000 });
});

test('exercício já feito e treino pausado não deixam o treino parado', async ({
  page,
}, testInfo) => {
  await workoutPage(page, testInfo, ['Prancha', 'Abdominal 2x15']);
  await page.getByRole('button', { name: 'Iniciar treino' }).click();
  await expect(page.getByRole('heading', { name: 'Prancha' })).toBeVisible();
  await page.getByRole('button', { name: 'Feita' }).click();
  await expect(page.getByRole('heading', { name: 'Abdominal' })).toBeVisible();

  // Voltar a um exercício feito: em vez de um "Feita" apagado, "Próximo exercício"
  await page.getByRole('button', { name: 'Anterior' }).click();
  await expect(page.getByRole('heading', { name: 'Prancha' })).toBeVisible();
  await expect(shown(page, 'Já feito')).toBeVisible();
  await page.getByRole('button', { name: 'Próximo exercício' }).click();
  await expect(page.getByRole('heading', { name: 'Abdominal' })).toBeVisible();

  // Pausado, o "Feita" diz por que não responde
  await page.getByRole('button', { name: 'Pausar o treino' }).click();
  await expect(page.getByRole('button', { name: 'Feita' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await expect(shown(page, 'Treino pausado: toque em ▶ para retomar')).toBeVisible();
  await page.getByRole('button', { name: 'Retomar o treino' }).click();
  await page.getByRole('button', { name: 'Feita' }).click();
  await expect(shown(page, 'Série 2 de 2')).toBeVisible();
});

test('séries avançadas: 1 de 14, 2 de 10, 1 de 8', async ({ page }, testInfo) => {
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const title = `Agachamento ${stamp}`;
  await workoutPage(page, testInfo, [title]);
  await page.getByRole('button', { name: `Detalhes de ${title}` }).click();

  await page.getByRole('textbox', { name: 'Séries', exact: true }).fill('1');
  await page.getByRole('textbox', { name: 'Repetições', exact: true }).fill('14');
  await page.getByRole('textbox', { name: 'Carga', exact: true }).fill('40kg');
  await page.getByRole('textbox', { name: 'Descanso', exact: true }).click();
  await page.getByRole('switch', { name: 'Séries avançadas' }).click();

  // O "+" no fim da linha copia a última com 1 série, para só ajustar
  await page.getByRole('button', { name: 'Adicionar séries' }).click();
  await expect(page.getByRole('textbox', { name: 'Repetições 2' })).toHaveValue('14');
  await page.getByRole('textbox', { name: 'Séries 2' }).fill('2');
  await page.getByRole('textbox', { name: 'Repetições 2' }).fill('10');
  await page.getByRole('textbox', { name: 'Carga 2' }).fill('45kg');
  await page.getByRole('button', { name: 'Adicionar séries' }).click();
  await page.getByRole('textbox', { name: 'Repetições 3' }).fill('8');
  await page.getByRole('textbox', { name: 'Carga 3' }).fill('40kg');
  await page.getByRole('textbox', { name: 'Descanso', exact: true }).click();

  await expect
    .poll(
      async () =>
        (await adminRest(`tasks?title=eq.${encodeURIComponent(title)}&select=repeat_plan,meta`))[0],
      { timeout: 20_000 },
    )
    .toEqual({
      repeat_plan: { mode: 'sets', total: 4, rest_seconds: 60 },
      meta: {
        sets: 4,
        reps: 14,
        weight: '40kg',
        groups: [
          { sets: 1, reps: 14, weight: '40kg' },
          { sets: 2, reps: 10, weight: '45kg' },
          { sets: 1, reps: 8, weight: '40kg' },
        ],
      },
    });
  await page.keyboard.press('Escape');
  await expect(shown(page, '1x14 40kg · 2x10 45kg · 1x8 40kg').first()).toBeVisible();

  // No treino, cada série mostra o que pede
  await page.getByRole('button', { name: 'Iniciar treino' }).click();
  await expect(shown(page, 'Série 1 de 4')).toBeVisible();
  await expect(shown(page, '14 reps · 40kg')).toBeVisible();
  await page.getByRole('button', { name: 'Feita' }).click();
  await page.keyboard.press('r');
  await expect(shown(page, '10 reps · 45kg')).toBeVisible();
  // Carga −/+ muda só o grupo desta série
  await page.getByRole('button', { name: 'Aumentar a carga' }).click();
  await expect(page.getByLabel('Carga: 47,5kg')).toBeVisible();
  await page.getByRole('button', { name: 'Feita' }).click();
  await page.keyboard.press('r');
  await expect(shown(page, '10 reps · 47,5kg')).toBeVisible();
  await page.getByRole('button', { name: 'Feita' }).click();
  await page.keyboard.press('r');
  await expect(shown(page, '8 reps · 40kg')).toBeVisible();
  await expect(shown(page, 'Série 4 de 4')).toBeVisible();
});

test('grupo de treino: voltar ao treino não pergunta de novo com quem', async ({
  page,
}, testInfo) => {
  const desktop = testInfo.project.name === 'desktop';
  await signUp(page, testInfo);
  await openTab(page, 'Início');
  const answer = page.waitForResponse((r) => r.url().includes('/rpc/set_gym_mode'));
  await page.getByRole('button', { name: 'Sim, vou treinar' }).click();
  await answer;
  const block = desktop ? page.getByRole('navigation') : page;
  if (!desktop) await openTab(page, 'Pastas');
  await block.getByRole('button', { name: 'Novo grupo de treino' }).first().click();
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const group = `Grupo ${stamp}`;
  await page.getByPlaceholder('Nome (ex.: Treino com a Ana)').fill(group);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(shown(page, 'Compartilhar').first()).toBeVisible({ timeout: 20_000 });

  // A pasta sobe para o servidor logo depois de aparecer na tela
  let folder: { id: string; owner_id: string } | undefined;
  await expect
    .poll(
      async () =>
        (folder = (
          await adminRest(`folders?name=eq.${encodeURIComponent(group)}&select=id,owner_id`)
        )[0]),
      { timeout: 20_000 },
    )
    .toBeTruthy();
  if (!folder) return;
  const [workout] = await adminRest('pages', {
    method: 'POST',
    body: JSON.stringify({ folder_id: folder.id, name: `Pernas ${stamp}`, view_type: 'cards' }),
  });
  await adminRest('tasks', {
    method: 'POST',
    body: JSON.stringify({
      page_id: workout.id,
      created_by: folder.owner_id,
      title: 'Leg press',
      position: 1,
      repeat_plan: { mode: 'sets', total: 3, rest_seconds: 60 },
    }),
  });

  await page.goto(`/treino/${workout.id}`);
  await page.getByRole('button', { name: 'Treinar sozinho' }).click({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Leg press' })).toBeVisible({ timeout: 20_000 });
  await waitForSync(page);
  const done = page.waitForResponse((r) => r.url().includes('/rpc/run_once'));
  await page.getByRole('button', { name: 'Feita' }).click();
  await done;
  // Costuma aparecer em menos de 0,1 s; uma vez em ~20 rodadas passou de 5 s (troca da linha do
  // aparelho pela do servidor), então a espera é mais folgada
  await expect(shown(page, 'Série 2 de 3')).toBeVisible({ timeout: 15_000 });

  // Sair e voltar: continua na série 2, sem o seletor "Quem está treinando junto agora?"
  await page.goto(`/page/${workout.id}`);
  await page.getByRole('button', { name: 'Continuar treino' }).click({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Leg press' })).toBeVisible({ timeout: 20_000 });
  // Depois de recarregar, a contagem às vezes chega com o sync (D216)
  await expect(shown(page, 'Série 2 de 3')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Quem está treinando junto agora?' })).toHaveCount(
    0,
  );
});
