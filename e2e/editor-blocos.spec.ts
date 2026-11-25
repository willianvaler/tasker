import { expect, test, type Page } from '@playwright/test';

import { adminRest, signUp } from './helpers';

// ED2 (ESCOPO_V16): copiar o link do bloco cria o ^id; a transclusão mostra só o bloco, atualiza
// quando a origem muda, avisa o ciclo e mostra "indisponível" para o bloco que sumiu.

const userIdOf = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    return JSON.parse(localStorage.getItem(key ?? '') ?? '{}').user?.id as string;
  });

test('transclusão de bloco', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'um perfil basta');
  test.setTimeout(120_000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signUp(page, testInfo);
  const uid = await userIdOf(page);
  const post = (title: string, body: string) =>
    adminRest('notes', { method: 'POST', body: JSON.stringify({ user_id: uid, title, body }) });
  const [origem] = await post(
    'Cálculo',
    'Intro do capítulo\n\nO limite existe quando os lados batem',
  );

  // Copiar o link do bloco: o ^id entra só naquele bloco
  await page.goto(`/nota/${origem.id}`);
  await page.getByRole('button', { name: 'Editar' }).click();
  const campo = page.getByRole('textbox', { name: 'Texto da anotação' });
  await campo.click();
  await page.keyboard.press('Control+End');
  await page.getByRole('button', { name: 'Mais' }).first().click();
  const salvo = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/notes') && r.request().method() === 'PATCH',
  );
  await page.getByRole('menuitem', { name: 'Copiar link do bloco' }).click();
  await expect(page.getByText(/Link do bloco copiado/)).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(new RegExp(`^\\[\\[Cálculo#\\^[a-z0-9]{6}\\|n:${origem.id}\\]\\]$`));
  const id = /#\^([a-z0-9]+)/.exec(link)![1];
  await salvo;
  await expect
    .poll(async () => (await adminRest(`notes?id=eq.${origem.id}&select=body`))[0].body)
    .toBe(`Intro do capítulo\n\nO limite existe quando os lados batem ^${id}`);

  // Outra anotação incorpora o bloco: só ele, sem a marca
  const [resumo] = await post('Resumo', `Resumo:\n\n!${link}`);
  await page.goto(`/nota/${resumo.id}`);
  const embed = page.getByTestId('embed-note');
  // O texto exato: o ^id do fim não aparece (só no cabeçalho, que diz de onde vem)
  await expect(
    embed.getByText('O limite existe quando os lados batem', { exact: true }),
  ).toBeVisible();
  await expect(embed.getByText('Intro do capítulo')).toHaveCount(0);

  // A origem muda: a transclusão acompanha
  await adminRest(`notes?id=eq.${origem.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ body: `Intro do capítulo\n\nO limite muda de valor ^${id}` }),
  });
  await page.reload();
  await expect(page.getByTestId('embed-note').getByText('O limite muda de valor')).toBeVisible();

  // Bloco apagado: indisponível, sem texto
  await adminRest(`notes?id=eq.${origem.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ body: 'Intro do capítulo' }),
  });
  await page.reload();
  await expect(page.getByText('Bloco indisponível.')).toBeVisible();

  // Ciclo: A mostra B, que mostra A
  const [a] = await post('A', 'Texto de A');
  const [b] = await post('B', `![[A|n:${a.id}]]`);
  await adminRest(`notes?id=eq.${a.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ body: `Texto de A\n\n![[B|n:${b.id}]]` }),
  });
  await page.goto(`/nota/${a.id}`);
  await expect(page.getByText(/já aparece acima \(ciclo\)/)).toBeVisible();
});
