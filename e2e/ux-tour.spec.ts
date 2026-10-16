import { expect, test, type Page } from '@playwright/test';

import { openTab } from './helpers';

// Roteiro da revisão de usabilidade (Y1): não é teste de regressão, só capturas de cada passo.
// Só roda quando pedido (UX_TOUR=1): não é teste de regressão
const OUT = 'test-results/ux-tour';
test.use({ storageState: { cookies: [], origins: [] } });

test('tour de usabilidade', async ({ page }, testInfo) => {
  test.skip(
    !process.env.UX_TOUR,
    'Roteiro de revisão: UX_TOUR=1 npm run e2e -- e2e/ux-tour.spec.ts',
  );
  test.setTimeout(240_000);
  const p = testInfo.project.name;
  let n = 0;
  const shot = async (name: string) =>
    page.screenshot({ path: `${OUT}/${p}-${String(++n).padStart(2, '0')}-${name}.png` });
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (err) {
      console.log(`UX-FALHA ${p} ${name}: ${(err as Error).message.split('\n')[0]}`);
    }
    await page.waitForTimeout(600);
    await shot(name);
  };

  // 1. Primeiro uso
  await page.goto('/');
  await shot('login');
  await page.getByText('Não tenho conta').click();
  await page.getByPlaceholder('Seu nome').fill('Ana Teste');
  await page.getByPlaceholder('E-mail').fill(`ux-${p}-${Date.now()}@teste.local`);
  await page.getByPlaceholder('Senha').fill('senha-forte-123');
  await shot('cadastro');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.getByRole('heading', { name: 'Do seu jeito' }).waitFor();
  await shot('onboarding-1');
  for (let i = 2; i <= 4; i++) {
    await page.getByRole('button', { name: 'Próximo' }).click();
    await shot(`onboarding-${i}`);
  }
  await page.getByRole('button', { name: 'Começar' }).click();
  await page.waitForTimeout(1500);
  await shot('inicio');

  // 2. Capturar e organizar o dia
  await step('hoje', () => openTab(page, 'Hoje'));
  await step('captura-rapida', async () => {
    const input = page.getByRole('textbox', { name: 'Nova tarefa' });
    await input.fill('Pagar a conta de luz amanhã !!');
    await input.press('Enter');
    await input.fill('Ligar para o dentista hoje');
    await input.press('Enter');
  });
  await step('abrir-tarefa', () =>
    page.getByRole('button', { name: 'Detalhes de Ligar para o dentista' }).click(),
  );
  await step('fechar-tarefa', () => page.keyboard.press('Escape'));

  // 3. Pasta, página e lista
  await step('pastas', () => openTab(page, 'Pastas'));
  await step('nova-pasta', async () => {
    await page
      .getByRole('button', { name: /Nova pasta|Criar a primeira pasta/ })
      .first()
      .click();
  });
  await step('nova-pasta-nome', async () => {
    await page.getByPlaceholder(/Nome/).first().fill('Casa');
    await page.keyboard.press('Enter');
  });
  await step('pasta-aberta', async () => {});
  await step('nova-pagina', async () => {
    await page
      .getByRole('button', { name: /Nova página|Criar a primeira página|Nova lista/ })
      .first()
      .click();
  });
  await step('nova-pagina-nome', async () => {
    await page.getByPlaceholder(/Nome/).first().fill('Mercado');
    await page.getByRole('button', { name: 'Salvar' }).click();
  });
  await step('lista-com-itens', async () => {
    const input = page.getByRole('textbox', { name: 'Nova tarefa' });
    for (const t of ['Leite', 'Pão', 'Café']) {
      await input.fill(t);
      await input.press('Enter');
    }
  });

  // 4. Hábitos
  await step('habitos', async () => {
    // No celular a página está duas telas acima das abas: vai direto
    if (p !== 'desktop') await page.goto('/habits');
    else await openTab(page, 'Hábitos');
  });
  await step('novo-habito', async () => {
    const input = page.getByRole('textbox').first();
    await input.fill('Beber água');
    await input.press('Enter');
  });

  // 5. Treino pelo Modo
  await step('modo', () =>
    page.getByRole('button', { name: 'Modo: treino, foco ou descanso' }).first().click(),
  );
  await step('fechar-modo', () => page.keyboard.press('Escape'));

  // 6. Projeto
  await step('novo-projeto', async () => {
    await openTab(page, 'Pastas');
    await page
      .getByRole('button', { name: /Novo projeto|Criar o primeiro projeto/ })
      .first()
      .click();
    await page.getByPlaceholder(/Nome/).first().fill('Mudança');
    await page.keyboard.press('Enter');
  });
  await step('projeto-aberto', async () => {});

  // 7. Anotações, perfil
  await step('perfil', () => openTab(page, 'Perfil'));
  await step('ajuda', () => page.goto('/ajuda'));
  await expect(page).toHaveURL(/ajuda/);
});
