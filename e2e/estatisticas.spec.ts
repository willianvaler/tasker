import { expect, test } from '@playwright/test';

import { openTab, shown, signUp } from './helpers';

// AC8 (D240): as estatísticas saem do diário: dias e tempo, mapa muscular pelo exercício ligado
// (com os que ficaram sem treino), volume por semana
test('estatísticas de treino: dia, mapa muscular e volume', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Tela igual; basta um perfil');
  test.setTimeout(60_000);
  await signUp(page, testInfo);
  await openTab(page, 'Início');
  await page.getByRole('button', { name: 'Sim, vou treinar' }).click();

  await page.goto('/treino-estatisticas');
  await expect(shown(page, /^Nenhuma série no diário ainda/)).toBeVisible({ timeout: 15_000 });

  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Novo treino' }).first().click();
  const name = `Treino ${Date.now()}`;
  await page.getByPlaceholder('Nome do treino (ex.: Treino A)').fill(name);
  await page.getByRole('button', { name: 'Salvar' }).click();
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Supino reto com barra 1x10 40kg');
  await input.press('Enter');
  await page.getByRole('button', { name: /^Detalhes de Supino/ }).click();
  await expect(page.getByText(/^Parece /)).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Ligar', exact: true }).click();
  await expect(page.getByText(/^Exercício: /)).toBeVisible();
  await page.goBack();

  await page.getByRole('button', { name: 'Iniciar treino' }).click();
  await page.getByRole('button', { name: 'Feita' }).click();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 });

  await page.goto('/treino-estatisticas');
  await expect(shown(page, /^1 dia de treino · /)).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole('img', { name: /^Mapa muscular\. Trabalhados: .*Peito/ }),
  ).toBeVisible();
  await expect(shown(page, /^Sem treino no período: .*Quadríceps/)).toBeVisible();
  await expect(page.getByLabel(/^\d{4}-W\d{2}: 400 kg, 1 série$/)).toBeVisible();
});

// AC9 (D241): exercício com barra: aquecimento sugerido antes da primeira série (um toque
// registra) e as anilhas de cada lado; a ficha tem a calculadora
test('aquecimento sugerido e anilhas por lado', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Tela igual; basta um perfil');
  test.setTimeout(60_000);
  await signUp(page, testInfo);
  await openTab(page, 'Início');
  await page.getByRole('button', { name: 'Sim, vou treinar' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Novo treino' }).first().click();
  const name = `Treino ${Date.now()}`;
  await page.getByPlaceholder('Nome do treino (ex.: Treino A)').fill(name);
  await page.getByRole('button', { name: 'Salvar' }).click();
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Supino reto com barra 1x10 60kg');
  await input.press('Enter');
  await page.getByRole('button', { name: /^Detalhes de Supino/ }).click();
  await expect(page.getByText(/^Parece /)).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Ligar', exact: true }).click();
  await expect(page.getByText(/^Exercício: /)).toBeVisible();
  await page.goBack();

  await page.getByRole('button', { name: 'Iniciar treino' }).click();
  await expect(shown(page, 'Aquecer antes')).toBeVisible({ timeout: 15_000 });
  await expect(shown(page, 'Por lado: 20')).toBeVisible();
  await page.getByRole('button', { name: '25 × 8' }).click();
  await expect(shown(page, 'Aquecimento 25 kg × 8 registrado')).toBeVisible();
  await page.getByRole('button', { name: 'Feita' }).click();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 });

  await page.goto('/biblioteca/mit-0025');
  await page.getByRole('textbox', { name: 'Carga total (kg)' }).fill('102,5');
  await expect(shown(page, 'Por lado: 25 + 15 + 1,25')).toBeVisible();
});

// AC9.4 (D242): superset: os dois exercícios se alternam sem descanso; o descanso vem no fim de
// cada rodada
test('superset alterna e descansa no fim da rodada', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'O Modo Treino é o mesmo; basta um perfil');
  test.setTimeout(60_000);
  await signUp(page, testInfo);
  await openTab(page, 'Início');
  await page.getByRole('button', { name: 'Sim, vou treinar' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Novo treino' }).first().click();
  const name = `Treino ${Date.now()}`;
  await page.getByPlaceholder('Nome do treino (ex.: Treino A)').fill(name);
  await page.getByRole('button', { name: 'Salvar' }).click();
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  for (const line of ['Supino 2x10 40kg', 'Remada 2x10 30kg']) {
    await input.fill(line);
    await input.press('Enter');
  }
  for (const title of ['Supino', 'Remada']) {
    await page.getByRole('button', { name: `Detalhes de ${title}` }).click();
    await page.getByRole('radio', { name: 'A', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'A', exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.goBack();
  }
  const rest = page.getByRole('timer', { name: /^Descanso: faltam/ });

  await page.getByRole('button', { name: 'Iniciar treino' }).click();
  await expect(page.getByRole('heading', { name: 'Supino' })).toBeVisible();
  await expect(shown(page, 'Superset A · 1 de 2')).toBeVisible();
  await page.getByRole('button', { name: 'Feita' }).click();
  // Para o segundo do grupo, sem descanso
  await expect(page.getByRole('heading', { name: 'Remada' })).toBeVisible();
  await expect(rest).toHaveCount(0);
  await page.getByRole('button', { name: 'Feita' }).click();
  // Fim da rodada: volta ao primeiro, descansando
  await expect(page.getByRole('heading', { name: 'Supino' })).toBeVisible();
  await expect(shown(page, 'Série 2 de 2')).toBeVisible();
  await expect(rest).toBeVisible();
});

// AC9.5 (D243): dias de treino na página; "Treino de hoje" na Hoje; remarcar para amanhã tira
// de hoje sem mexer no plano, e desfazer volta
test('plano da semana: treino de hoje e remarcar', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Tela igual; basta um perfil');
  test.setTimeout(60_000);
  await signUp(page, testInfo);
  await openTab(page, 'Início');
  await page.getByRole('button', { name: 'Sim, vou treinar' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Novo treino' }).first().click();
  const name = `Treino ${Date.now()}`;
  await page.getByPlaceholder('Nome do treino (ex.: Treino A)').fill(name);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();

  // Todos os dias: hoje é dia de treino, qualquer que seja
  await page.getByRole('button', { name: 'Opções da lista' }).click();
  await page.getByRole('menuitem', { name: 'Configurar lista' }).click();
  for (const day of ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'])
    await page.getByRole('checkbox', { name: day, exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Dom', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('button', { name: 'Cancelar' }).click();

  await openTab(page, 'Hoje');
  await expect(shown(page, 'Treino de hoje')).toBeVisible({ timeout: 15_000 });
  // (o nome aparece também na barra lateral: vale o botão da linha)
  await expect(page.getByRole('button', { name: 'Remarcar' })).toBeVisible();
  await page.getByRole('button', { name: 'Remarcar' }).click();
  await page.getByRole('menuitem', { name: 'Amanhã', exact: true }).click();
  await expect(shown(page, `${name} foi para Amanhã`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remarcar' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByRole('button', { name: 'Remarcar' })).toBeVisible({ timeout: 15_000 });
});
