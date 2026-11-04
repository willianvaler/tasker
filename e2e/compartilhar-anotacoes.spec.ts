import { devices, expect, test, type Page } from '@playwright/test';

import { adminRest, signUp } from './helpers';

const userIdOf = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    return JSON.parse(localStorage.getItem(key ?? '') ?? '{}').user?.id as string;
  });

const savedNote = (page: Page) =>
  page.waitForResponse(
    (r) => r.url().includes('/rest/v1/notes') && r.request().method() === 'PATCH' && r.ok(),
  );

async function openShareDialog(page: Page) {
  await page.getByRole('button', { name: 'Mais opções da anotação' }).click();
  await page.getByRole('menuitem', { name: 'Compartilhar e publicar' }).click();
}

// OB14 (ESCOPO_V11 §8, D300): a Ana compartilha uma anotação com a Bia (amiga) para editar; a Bia
// acha em "Compartilhadas comigo", muda o texto e a Ana vê sem recarregar. Só ler tira a edição;
// sair tira da lista. Publicada com senha e com a anotação citada, abre sem conta em /p/<token>.
test('anotações: compartilhar com amiga e publicar com senha', async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'duas pessoas: basta um perfil');
  test.setTimeout(150_000);
  const stamp = Date.now();
  await signUp(page, testInfo);
  const ana = await userIdOf(page);
  const biaContext = await browser.newContext({ ...devices['Desktop Chrome'] });
  const bia = await biaContext.newPage();
  await signUp(bia, testInfo);
  const biaId = await userIdOf(bia);
  const [a, b] = [ana, biaId].sort();
  await adminRest('friendships', {
    method: 'POST',
    body: JSON.stringify({
      user_a: a,
      user_b: b,
      requested_by: ana,
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    }),
  });
  // A anotação citada (pessoal da Ana), para o conjunto publicado
  const [other] = await adminRest('notes', {
    method: 'POST',
    body: JSON.stringify({ user_id: ana, title: `Citada ${stamp}`, body: `texto citado ${stamp}` }),
  });

  // Ana escreve e compartilha para editar
  await page.goto('/notas');
  await page.getByRole('button', { name: 'Nova anotação' }).first().click();
  await page.getByRole('textbox', { name: 'Título da anotação' }).fill(`Plano ${stamp}`);
  const body = page.getByRole('textbox', { name: 'Texto da anotação' });
  let saved = savedNote(page);
  await body.fill(`da Ana ${stamp} e [[Citada|n:${other.id}]]`);
  await saved;
  await openShareDialog(page);
  await page.getByRole('radio', { name: 'Pode editar' }).click();
  const shared = page.waitForResponse((r) => r.url().includes('/rpc/share_note') && r.ok());
  await page.getByRole('button', { name: 'Adicionar' }).first().click();
  await shared;
  await expect(page.getByText('Pode editar').first()).toBeVisible();
  await page.getByRole('button', { name: 'Fechar' }).first().click();
  await expect(page.getByText('Compartilhada com 1 pessoa')).toBeVisible();

  // Bia acha, abre e edita; a Ana (sem nada por gravar) vê o texto novo sozinha
  await bia.goto('/notas');
  const sharedList = bia.getByRole('list', { name: 'Compartilhadas comigo' });
  await sharedList.getByRole('link', { name: new RegExp(`Plano ${stamp}`) }).click();
  await expect(bia.getByTestId('shared-banner')).toContainText('você pode editar');
  await bia.getByRole('button', { name: 'Editar' }).click();
  saved = savedNote(bia);
  await bia
    .getByRole('textbox', { name: 'Texto da anotação' })
    .fill(`da Bia ${stamp} e [[Citada|n:${other.id}]]`);
  await saved;
  await expect(body).toHaveValue(`da Bia ${stamp} e [[Citada|n:${other.id}]]`, {
    timeout: 20_000,
  });

  // Só ler: a Bia perde o Editar
  await openShareDialog(page);
  const role = page.waitForResponse((r) => r.url().includes('/rpc/share_note') && r.ok());
  await page.getByRole('button', { name: 'Só ler' }).click();
  await role;

  // Publicar com a citada e com senha
  const published = page.waitForResponse((r) => r.url().includes('/rpc/publish_note') && r.ok());
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await published;
  const url = (await page.getByTestId('published-url').textContent())?.trim() ?? '';
  expect(url).toMatch(/\/p\/[A-Za-z0-9_-]{20,}$/);
  let changed = page.waitForResponse((r) => r.url().includes('/rpc/publish_note') && r.ok());
  await page.getByRole('switch', { name: 'Levar as anotações citadas' }).click();
  await changed;
  await page.getByLabel('Senha nova (4 ou mais letras)').fill('segredo1');
  changed = page.waitForResponse((r) => r.url().includes('/rpc/publish_note') && r.ok());
  await page.getByRole('button', { name: 'Pôr senha' }).click();
  await changed;
  await expect(page.getByText('Com senha: quem abre precisa digitar.')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar' }).first().click();

  await bia.reload();
  await expect(bia.getByTestId('shared-banner')).toContainText('você só lê', { timeout: 20_000 });
  await expect(bia.getByRole('button', { name: 'Editar' })).toHaveCount(0);

  // Sem conta: pede a senha, recusa a errada, abre com a certa e navega pelo conjunto
  const visitorContext = await browser.newContext({ ...devices['Desktop Chrome'] });
  const visitor = await visitorContext.newPage();
  await visitor.goto(new URL(url).pathname);
  await expect(visitor.getByRole('heading', { name: 'Esta anotação tem senha' })).toBeVisible();
  await visitor.getByLabel('Senha').fill('errada');
  await visitor.getByRole('button', { name: 'Abrir' }).click();
  await expect(visitor.getByText('Senha errada.')).toBeVisible();
  await visitor.getByLabel('Senha').fill('segredo1');
  await visitor.getByRole('button', { name: 'Abrir' }).click();
  await expect(visitor.getByRole('heading', { name: `Plano ${stamp}` })).toBeVisible();
  await expect(visitor.getByText(`da Bia ${stamp}`)).toBeVisible();
  const set = visitor.getByRole('navigation', { name: 'Neste endereço' });
  await set.getByRole('link', { name: `Citada ${stamp}` }).click();
  await expect(visitor.getByText(`texto citado ${stamp}`)).toBeVisible();

  // Despublicar: o endereço deixa de existir
  await openShareDialog(page);
  const gone = page.waitForResponse((r) => r.url().includes('/rpc/unpublish_note') && r.ok());
  await page.getByRole('button', { name: 'Despublicar' }).click();
  await gone;
  await visitor.reload();
  await expect(visitor.getByText('Este endereço não existe mais.')).toBeVisible();

  // Bia sai da anotação
  await bia.getByRole('button', { name: 'Mais opções da anotação' }).click();
  const left = bia.waitForResponse((r) => r.url().includes('/rpc/unshare_note') && r.ok());
  await bia.getByRole('menuitem', { name: 'Sair da anotação' }).click();
  await left;
  await bia.goto('/notas');
  await expect(bia.getByRole('list', { name: 'Compartilhadas comigo' })).toHaveCount(0);

  await visitorContext.close();
  await biaContext.close();
});
