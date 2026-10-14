import { expect, test, type Page } from '@playwright/test';

import { createPage, openTab, paste, signUp } from '../e2e/helpers';

const THEMES = [
  ['claro', 'light'],
  ['escuro', 'dark'],
] as const;

async function shoot(page: Page, name: string, project: string) {
  for (const [label, scheme] of THEMES) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `docs/screenshots/${name}-${project}-${label}.png` });
  }
  await page.emulateMedia({ colorScheme: 'light' });
}

async function addMany(page: Page, lines: string[]) {
  await page.getByRole('textbox', { name: 'Nova tarefa' }).click();
  await paste(page, lines.join('\n'));
  await page.getByRole('button', { name: `Criar ${lines.length}` }).click();
}

test('telas-chave', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const project = testInfo.project.name;
  await signUp(page, testInfo);

  // Hoje com tarefas de verdade
  await addMany(page, [
    'Pagar a conta de luz hoje !!!',
    'Comprar carvão e gelo hoje !!',
    'Treino A — peito e tríceps hoje',
    'Ligar para a mãe hoje',
  ]);
  await expect(page.getByText('Ligar para a mãe').first()).toBeVisible();
  await page.getByRole('checkbox', { name: 'Concluir Ligar para a mãe' }).first().click();
  await page.waitForTimeout(500);
  await shoot(page, 'hoje', project);
  await openTab(page, 'Início');
  await page.waitForTimeout(400);
  await shoot(page, 'inicio', project);

  // Página em lista
  await createPage(page, { folder: 'Mercado', name: 'Lista da semana', type: 'Lista' });
  await addMany(page, [
    'Leite (2 caixas) #frios',
    'Pão integral',
    'Café em grão',
    'Detergente #limpeza',
    'Arroz 5 kg',
  ]);
  await expect(page.getByText('Arroz 5 kg')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Concluir Arroz 5 kg' }).click();
  await shoot(page, 'pagina-lista', project);

  // Painel da tarefa
  await page.getByRole('button', { name: 'Detalhes de Café em grão' }).click();
  await expect(page.getByRole('textbox', { name: 'Título', exact: true })).toBeVisible();
  await page.waitForTimeout(400);
  await shoot(page, 'painel-tarefa', project);
  // Volta para as abas (no celular a página abre por cima delas)
  await page.goto('/');

  // Página em cards
  await createPage(page, { folder: 'Academia', name: 'Treino A', type: 'Cards' });
  await addMany(page, ['Supino reto', 'Supino inclinado', 'Crucifixo', 'Tríceps corda']);
  await expect(page.getByText('Tríceps corda')).toBeVisible();
  await shoot(page, 'pagina-cards', project);

  await page.goto('/');
  await openTab(page, 'Pastas');
  await shoot(page, 'pastas', project);

  await openTab(page, 'Perfil');
  await page.waitForTimeout(400);
  await shoot(page, 'perfil', project);
});
