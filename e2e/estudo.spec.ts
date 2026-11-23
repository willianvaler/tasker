import { expect, test } from '@playwright/test';

import { adminRest, createPage, signUp, waitForSync } from './helpers';

// ES7 (ESCOPO_V13 §5, D328): projeto de estudo. Ligado, a lista abre a ficha e o projeto mostra o que
// estudar agora; a tela de leitura passa pelo material da sessão (anterior/próximo), guarda a página
// do PDF e conclui a sessão, e o cartão passa para a seguinte.
const PDF = Buffer.from(`%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
trailer<</Root 1 0 R>>
%%EOF`);

test('projeto de estudo: o que estudar agora, ler o material e concluir a sessão', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const folder = `Engenharia ${testInfo.project.name}${Date.now()}`;
  await signUp(page, testInfo);
  await createPage(page, { folder, name: 'Fase 1A · Alavancas', type: 'Lista' });
  const listUrl = page.url();
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  for (const title of ['M01 · Balança de régua', 'M02 · Ponte de palitos']) {
    await input.fill(title);
    await input.press('Enter');
    await expect(page.getByRole('button', { name: `Detalhes de ${title}` })).toBeVisible();
  }
  await waitForSync(page);
  // A pasta vira projeto (o menu Novo é do teclado; aqui, direto no banco)
  await adminRest(`folders?name=eq.${encodeURIComponent(folder)}`, {
    method: 'PATCH',
    body: JSON.stringify({ kind: 'project' }),
  });

  await page.goto('/folders');
  await page.getByRole('link', { name: folder }).first().click();
  await expect(page.getByRole('heading', { name: folder })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('switch', { name: /É um plano de estudos/ }).click();
  const card = page.getByTestId('study-now');
  await expect(card.getByText('M01 · Balança de régua')).toBeVisible();

  // O material da sessão
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Adicionar material' }).click();
  await (
    await chooser
  ).setFiles([
    { name: '03 - M01 - Assis.pdf', mimeType: 'application/pdf', buffer: PDF },
    {
      name: '04 - M01 - Equilíbrio.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(
        `# Equilíbrio\n\n${'Texto do capítulo. '.repeat(400)}\n\nFim do capítulo.`,
      ),
    },
  ]);
  await expect(page.getByText(/2 materiais adicionados/)).toBeVisible({ timeout: 60_000 });
  await expect(card.getByText('03 - M01 - Assis · 04 - M01 - Equilíbrio')).toBeVisible();

  // Estudar: abre o primeiro material, com a sessão embaixo
  await card.getByRole('button', { name: 'Estudar' }).click();
  await expect(page.getByRole('heading', { name: '03 - M01 - Assis' })).toBeVisible();
  const session = page.getByTestId('study-session');
  await expect(session.getByText('M01 · Balança de régua')).toBeVisible();
  // Onde parei: a página do PDF fica guardada e o leitor abre nela
  const saved = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/reading_positions') && r.request().method() === 'POST',
  );
  const pageBox = page.getByRole('textbox', { name: 'Página onde parei' });
  await pageBox.fill('5');
  await pageBox.press('Enter');
  expect((await saved).ok()).toBe(true);
  await expect(page.getByTestId('pdf-frame')).toHaveAttribute('src', /#page=5$/);

  // Próximo: a anotação em leitura, com o texto maior
  await page.getByRole('button', { name: 'Próximo' }).click();
  await expect(page.getByRole('heading', { name: '04 - M01 - Equilíbrio' })).toBeVisible();
  await expect(page.getByTestId('note-reader').getByText('Fim do capítulo.')).toBeAttached();
  await page.getByRole('button', { name: 'Texto maior' }).click();
  // Onde parei na anotação: a rolagem fica guardada e volta ao reabrir
  const reader = page.getByTestId('note-reader');
  const scrolled = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/reading_positions') && r.request().method() === 'POST',
  );
  // (o react-native-web troca o scrollTo do elemento pelo do React Native: rola pelo scrollTop)
  await reader.evaluate((el) => {
    el.scrollTop = el.scrollHeight / 2;
  });
  expect((await scrolled).ok()).toBe(true);
  await page.reload();
  await expect(page.getByTestId('note-reader').getByText('Fim do capítulo.')).toBeAttached();
  await expect
    .poll(() => page.getByTestId('note-reader').evaluate((el) => el.scrollTop))
    .toBeGreaterThan(100);
  await expect(page.getByRole('button', { name: 'Próximo' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  // Voltar ao PDF: a página guardada continua
  await page.getByRole('button', { name: 'Anterior' }).click();
  await expect(page.getByTestId('pdf-frame')).toHaveAttribute('src', /#page=5$/);

  // Concluir a sessão: o cartão passa para a seguinte
  await session.getByRole('button', { name: 'Concluir sessão' }).click();
  await expect(session.getByRole('button', { name: 'Reabrir' })).toBeVisible();
  // Navegar logo depois cancela o envio: espera a conclusão chegar ao servidor
  const [row] = await adminRest(`folders?name=eq.${encodeURIComponent(folder)}&select=id`);
  await expect
    .poll(
      async () =>
        (
          await adminRest(
            `tasks?folder_id=eq.${row.id}&title=eq.${encodeURIComponent('M01 · Balança de régua')}&select=status`,
          )
        )[0]?.status,
      { timeout: 20_000 },
    )
    .toBe('done');
  await page.goto('/folders');
  await page.getByRole('link', { name: folder }).first().click();
  await expect(page.getByTestId('study-now').getByText('M02 · Ponte de palitos')).toBeVisible({
    timeout: 20_000,
  });

  // Num projeto de estudo, a seta da lista abre a ficha (não o painel)
  await page.goto(listUrl);
  await page.getByRole('button', { name: 'Detalhes de M02 · Ponte de palitos' }).click();
  await expect(page.getByRole('heading', { name: 'M02 · Ponte de palitos' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Título', exact: true })).toHaveCount(0);
});
