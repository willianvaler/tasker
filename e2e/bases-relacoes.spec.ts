import { expect, test, type Page } from '@playwright/test';

import { adminRest, createPage, signUp } from './helpers';

// ED3 (ESCOPO_V16): relação bidirecional entre duas bases e rollup calculado na tela.

const userIdOf = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    return JSON.parse(localStorage.getItem(key ?? '') ?? '{}').user?.id as string;
  });

test('relação com inversa e rollup', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'um perfil basta');
  test.setTimeout(150_000);
  const stamp = `${Date.now()}${testInfo.repeatEachIndex}${Math.floor(Math.random() * 1e4)}`;
  await signUp(page, testInfo);
  const uid = await userIdOf(page);
  const livros = {
    id: await createPage(page, {
      folder: `Leitura ${stamp}`,
      name: `Livros ${stamp}`,
      type: 'Base',
    }),
  };
  const [{ folder_id }] = await adminRest(`pages?id=eq.${livros.id}&select=folder_id`);
  const [caps] = await adminRest('pages', {
    method: 'POST',
    body: JSON.stringify({ folder_id, name: `Capítulos ${stamp}`, view_type: 'base' }),
  });
  const note = async (title: string, body: string, props: Record<string, unknown> = {}) =>
    (
      await adminRest('notes', {
        method: 'POST',
        body: JSON.stringify({ user_id: uid, title, body, props }),
      })
    )[0];
  const livro = await note(`Cálculo ${stamp}`, '#livro');
  await note(`Cap 1 ${stamp}`, '#capitulo', { horas: 2 });
  const c2 = await note(`Cap 2 ${stamp}`, '#capitulo', { horas: 3 });
  await adminRest(`pages?id=eq.${caps.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      config: { query: 'anotações onde etiqueta = capitulo', view: 'table', columns: [] },
    }),
  });
  await adminRest(`pages?id=eq.${livros.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      config: {
        query: 'anotações onde etiqueta = livro',
        view: 'table',
        columns: ['props.Capítulos', 'props.Horas'],
        schema: {
          Capítulos: { tipo: 'relacao', base: caps.id, inversa: 'Livro' },
          Horas: { tipo: 'rollup', relacao: 'Capítulos', propriedade: 'horas', funcao: 'sum' },
        },
      },
    }),
  });

  await page.goto(`/page/${livros.id}`);
  const table = page.getByRole('table');
  // A configuração foi gravada por fora: recarrega até a base aparecer com ela (cache do disco)
  await expect(async () => {
    await page.reload();
    await expect(table.getByRole('cell', { name: /^Capítulos: / })).toBeVisible({
      timeout: 20_000,
    });
  }).toPass({ timeout: 90_000 });
  await table.getByRole('cell', { name: /^Capítulos: / }).click();
  const campo = table.getByRole('textbox', { name: `Capítulos: Cálculo ${stamp}` });
  await campo.fill(`cap 1 ${stamp}, Cap 2 ${stamp}`);
  const gravou = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/notes') && r.request().method() === 'PATCH',
  );
  await campo.press('Enter');
  await gravou;

  // O rollup soma as horas das relacionadas (2 + 3), e a inversa aparece do outro lado
  await expect(table.getByRole('cell', { name: '5', exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    table.getByRole('cell', { name: `Capítulos: Cap 1 ${stamp}, Cap 2 ${stamp}` }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      JSON.stringify((await adminRest(`notes?id=eq.${c2.id}&select=props`))[0].props.Livro ?? null),
    )
    .toContain(livro.id);
  // O rollup não se edita
  await table.getByRole('cell', { name: '5', exact: true }).click();
  await expect(table.getByRole('textbox', { name: `Horas: Cálculo ${stamp}` })).toHaveCount(0);
  // Nada do rollup é gravado na anotação
  const [l] = await adminRest(`notes?id=eq.${livro.id}&select=props`);
  expect(l.props.Horas).toBeUndefined();
});
