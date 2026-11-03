import { expect, test, type Page } from '@playwright/test';

import { adminRest, signUp } from './helpers';

const savedNote = (page: Page) =>
  page.waitForResponse(
    (r) => r.url().includes('/rest/v1/notes') && r.request().method() === 'PATCH' && r.ok(),
  );

// OB11 (ESCOPO_V11 §8, D296): a versão de antes fica guardada, a diferença aparece e restaurar
// volta o texto (guardando o de agora); as versões contam no espaço, em Configurações.
test('anotações: histórico de versões, diferença e restaurar', async ({ page }, testInfo) => {
  const stamp = `${testInfo.project.name}${Date.now()}`;
  await signUp(page, testInfo);
  await page.goto('/notas');
  await page.getByRole('button', { name: 'Nova anotação' }).first().click();
  await page.getByRole('textbox', { name: 'Título da anotação' }).fill(`Versões ${stamp}`);
  const body = page.getByRole('textbox', { name: 'Texto da anotação' });
  let saved = savedNote(page);
  await body.fill(`primeira ${stamp}\ncomum`);
  await saved;
  await page.waitForTimeout(1200);
  // Uma sessão de edição "de ontem": as versões dela ficam para trás dos 10 minutos
  const noteId = /\/nota\/([0-9a-f-]{36})/.exec(page.url())?.[1];
  expect(noteId).toBeTruthy();
  await adminRest(`note_versions?note_id=eq.${noteId}`, {
    method: 'PATCH',
    body: JSON.stringify({ created_at: '2026-01-01T12:00:00Z' }),
  });
  // A gravação da sessão nova guarda o texto de antes
  saved = savedNote(page);
  await body.fill(`segunda ${stamp}\ncomum`);
  await saved;

  await page.getByRole('button', { name: 'Mais opções da anotação' }).click();
  await page.getByRole('menuitem', { name: 'Histórico de versões' }).click();
  const list = page.getByRole('list', { name: 'Versões guardadas' });
  // A da sessão "de ontem" (e, se a primeira gravação pegou só o título, a dela também)
  await expect(list.getByRole('button').first()).toBeVisible();
  const before = await list.getByRole('button').count();
  const diff = page.getByTestId('version-diff');
  await expect(diff.getByLabel(`Só nesta versão: primeira ${stamp}`)).toBeVisible();
  await expect(diff.getByLabel(`Só no texto de agora: segunda ${stamp}`)).toBeVisible();

  // Restaurar: pede confirmação e volta o texto
  await page.getByRole('button', { name: 'Restaurar esta versão' }).click();
  const restored = page.waitForResponse((r) => r.url().includes('/rpc/restore_note_version'));
  await page.getByRole('button', { name: 'Restaurar esta versão' }).click();
  expect((await restored).ok()).toBe(true);
  await expect(page.getByText(/Anotação de volta à versão de/)).toBeVisible();
  await expect(body).toHaveValue(`primeira ${stamp}\ncomum`);

  // Recarregar: o servidor tem o texto restaurado, e o de antes virou versão
  await page.reload();
  await page.getByRole('button', { name: 'Editar' }).click({ timeout: 15_000 });
  await expect(body).toHaveValue(`primeira ${stamp}\ncomum`);
  await page.getByRole('button', { name: 'Mais opções da anotação' }).click();
  await page.getByRole('menuitem', { name: 'Histórico de versões' }).click();
  await expect(list.getByRole('button')).toHaveCount(before + 1);
  await expect(diff.getByLabel(`Só nesta versão: segunda ${stamp}`)).toBeVisible();

  // Apagar uma versão
  await page.getByRole('button', { name: 'Apagar esta versão' }).click();
  await page.getByRole('button', { name: 'Apagar esta versão' }).click();
  await expect(list.getByRole('button')).toHaveCount(before);
  await page.getByRole('button', { name: 'Fechar', exact: true }).last().click();

  // O espaço das versões aparece em Configurações
  await page.goto('/configuracoes');
  await expect(page.getByText(/Versões das anotações: .* \(já contadas no total\)/)).toBeVisible();
});
