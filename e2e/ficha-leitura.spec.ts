import { expect, test } from '@playwright/test';

import { createPage, signUp } from './helpers';

// Ficha de leitura da tarefa (ES1, D322): o Calendário (e o grafo, os links, as Bases, a busca)
// abre a tarefa para ler, com a descrição formatada; Editar leva ao painel. Com "Abrir as tarefas
// para ler" ligado, a seta da lista também abre a ficha.

test('ficha de leitura: ler a descrição formatada e Editar abre o painel', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Estudos', name: 'Física', type: 'Lista' });
  const listUrl = page.url();
  const title = `Torque ${testInfo.project.name}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(`${title} hoje`);
  await input.press('Enter');

  // Descrição com Markdown, pelo painel
  await page.getByRole('button', { name: `Detalhes de ${title}` }).click();
  await page.getByRole('button', { name: 'Adicionar descrição' }).click();
  const notes = page.getByRole('textbox', { name: 'Descrição' });
  await notes.fill('Ler **a segunda condição** do equilíbrio.\n\n- prever\n- medir');
  await notes.blur();
  await page.getByRole('button', { name: 'Voltar' }).last().click();

  // O Calendário abre a ficha, não o painel
  await page.goto('/calendario');
  await page
    .getByRole('link', { name: new RegExp(title) })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByTestId('reader-notes').getByText('a segunda condição')).toBeVisible();
  await expect(page.getByTestId('reader-notes').getByText('medir')).toBeVisible();
  // Na ficha não há campo de título para editar
  await expect(page.getByRole('textbox', { name: 'Título', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Título', exact: true })).toHaveValue(title);

  // Ficha em todo lugar: a seta da lista também abre a ficha
  await page.goto('/configuracoes');
  await page.getByRole('switch', { name: /Abrir as tarefas para ler/ }).click();
  await page.goto(listUrl);
  await page.getByRole('button', { name: `Detalhes de ${title}` }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Título', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Título', exact: true })).toBeVisible();
});

// Fórmulas LaTeX (ES2, D323): bloco e na linha desenhados em SVG; dinheiro continua texto
test('fórmulas LaTeX na descrição, vistas na ficha', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Física', name: 'Estática', type: 'Lista' });
  const title = `Equilíbrio ${testInfo.project.name}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(`${title} hoje`);
  await input.press('Enter');
  await page.getByRole('button', { name: `Detalhes de ${title}` }).click();
  await page.getByRole('button', { name: 'Adicionar descrição' }).click();
  const notes = page.getByRole('textbox', { name: 'Descrição' });
  await notes.fill(
    'O torque:\n\n$$\n\\tau = rF \\sin\\theta\n$$\n\nonde $r$ é a distância. A régua custou R$ 10.',
  );
  await notes.blur();
  await page.getByRole('button', { name: 'Voltar' }).last().click();

  await page.goto('/calendario');
  await page
    .getByRole('link', { name: new RegExp(title) })
    .first()
    .click();
  const reader = page.getByTestId('reader-notes');
  await expect(reader.getByTestId('math-block')).toBeVisible({ timeout: 15_000 });
  await expect(reader.getByTestId('math-inline')).toBeVisible();
  await expect(reader.getByText(/R\$ 10/)).toBeVisible();
  await expect(reader.getByText('$$', { exact: false })).toHaveCount(0);
});
