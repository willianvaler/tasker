import { expect, test, type Page } from '@playwright/test';

import { openTab, signUp } from './helpers';

// A mini-barra (o painel do descanso tem outra contagem)
const bar = (page: Page) => page.getByRole('timer', { name: /^(?!Descanso: faltam)/ });

test('pomodoro: foco na tarefa, sugestão de pausa, pausa e o foco seguinte', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  // O relógio da página é do teste: 25 minutos passam num instante
  await page.clock.install();
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Escrever relatório');
  await input.press('Enter');

  await page.getByRole('button', { name: 'Detalhes de Escrever relatório' }).click();
  await expect(page.getByText('Pomodoros: 0')).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar pomodoro' }).click();
  await expect(bar(page)).toHaveAccessibleName(/^Foco 1\/4 · Escrever relatório: (25:00|24:5\d)$/);
  await page.getByRole('button', { name: 'Voltar' }).click();

  // Fim do foco: aviso com a sugestão de pausa e o botão da pausa
  await page.clock.fastForward('25:05');
  await expect(bar(page)).toHaveCount(0);
  const done = page.getByRole('alert').filter({ hasText: /^Foco concluído\. Que tal / });
  await expect(done).toBeVisible();
  await done.getByRole('button', { name: 'Pausa de 5 min' }).click();
  await expect(bar(page)).toHaveAccessibleName(/^Pausa · Escrever relatório: (5:00|4:5\d)$/);

  await page.clock.fastForward('05:05');
  const back = page.getByRole('alert').filter({ hasText: 'Pausa encerrada.' });
  await expect(back).toBeVisible();
  await back.getByRole('button', { name: 'Focar de novo' }).click();
  await expect(bar(page)).toHaveAccessibleName(/^Foco 2\/4 · Escrever relatório: /);
  await bar(page).getByRole('button', { name: 'Parar' }).click();
  await expect(bar(page)).toHaveCount(0);
});

test('pomodoro: P na tarefa selecionada', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Teclado: desktop');
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Ler artigo');
  await input.press('Enter');
  await expect(page.getByRole('checkbox', { name: 'Concluir Ler artigo' })).toBeVisible();
  await page.locator('body').click({ position: { x: 600, y: 600 } });
  await page.keyboard.press('j');
  await page.keyboard.press('p');
  await expect(bar(page)).toHaveAccessibleName(/^Foco 1\/4 · Ler artigo: /);
});

test('pomodoro: configurar durações e sugestões de pausa (em ordem)', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await page.clock.install();
  await signUp(page, testInfo);
  await page.goto('/pomodoro');
  const focus = page.getByRole('textbox', { name: 'Foco (min)' });
  await expect(focus).toHaveValue('25');
  const saved = () =>
    page.waitForResponse(
      (r) => r.url().includes('pomodoro_settings') && r.request().method() === 'POST',
    );
  let wait = saved();
  await focus.fill('30');
  await focus.press('Enter');
  await wait;

  // Tira "beber água", acrescenta uma, põe a nova em primeiro e escolhe "Em ordem"
  wait = saved();
  await page.getByRole('button', { name: 'Tirar beber água' }).click();
  await wait;
  wait = saved();
  await page.getByRole('textbox', { name: 'Nova sugestão' }).fill('ler uma página');
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await wait;
  for (let i = 0; i < 4; i++) {
    wait = saved();
    await page.getByRole('button', { name: 'Subir ler uma página' }).click();
    await wait;
  }
  wait = saved();
  await page.getByRole('radio', { name: 'Em ordem' }).click();
  await wait;

  await page.reload();
  await expect(focus).toHaveValue('30');
  await expect(page.getByRole('button', { name: 'Tirar beber água' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Subir ler uma página' })).toBeDisabled();
  await expect(page.getByRole('radio', { name: 'Em ordem' })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // O primeiro foco usa a primeira sugestão
  if (testInfo.project.name === 'celular') return;
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /^Olá/ })).toBeVisible();
  await page.keyboard.press('Control+k');
  await page.getByRole('textbox', { name: 'Buscar ou executar' }).fill('iniciar pomodoro');
  await page.keyboard.press('Enter');
  await expect(bar(page)).toHaveAccessibleName(/^Foco 1\/4: (30:00|29:5\d)$/);
  await page.clock.fastForward('30:05');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Foco concluído. Que tal ler uma página?' }),
  ).toBeVisible();
});
