import { expect, test, type Page } from '@playwright/test';

import { adminRest, signUp } from './helpers';

// ED1 (ESCOPO_V16): abrir uma anotação antiga, entrar e sair da edição sem mexer não grava nada,
// e uma anotação acima do teto antigo de 20 mil caracteres abre e salva.

const userIdOf = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    return JSON.parse(localStorage.getItem(key ?? '') ?? '{}').user?.id as string;
  });

test('abrir e sair sem mexer não grava; anotação grande salva', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'um perfil basta');
  test.setTimeout(120_000);
  await signUp(page, testInfo);
  const uid = await userIdOf(page);
  const corpo =
    'Texto com espaço no fim   \r\nlinha do Windows\n\n<details>html</details> ^bloco1\n\n```desconhecida\nx\n```';
  const [nota] = await adminRest('notes', {
    method: 'POST',
    body: JSON.stringify({ user_id: uid, title: 'Antiga', body: corpo }),
  });

  const escritas: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/rest/v1/notes') && ['PATCH', 'POST', 'PUT'].includes(r.method()))
      escritas.push(r.method());
  });
  await page.goto(`/nota/${nota.id}`);
  await expect(
    page
      .getByRole('heading', { name: 'Antiga' })
      .or(page.getByRole('textbox', { name: 'Título da anotação' })),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Editar' }).click();
  await expect(page.getByRole('textbox', { name: 'Texto da anotação' })).toBeVisible();
  await page.getByRole('button', { name: 'Visualizar' }).click();
  await page.goto('/notas');
  await page.waitForTimeout(1500);
  expect(escritas).toEqual([]);
  const [depois] = await adminRest(`notes?id=eq.${nota.id}&select=body,updated_at`);
  expect(depois.body).toBe(corpo);

  // Anotação acima do teto antigo (20 mil): 60 mil caracteres abrem, editam e salvam
  const grande = Array.from(
    { length: 3000 },
    (_, i) => `Parágrafo ${i} com texto suficiente.`,
  ).join('\n\n');
  const [g] = await adminRest('notes', {
    method: 'POST',
    body: JSON.stringify({ user_id: uid, title: 'Grande', body: grande }),
  });
  await page.goto(`/nota/${g.id}`);
  await page.getByRole('button', { name: 'Editar' }).click();
  const campo = page.getByRole('textbox', { name: 'Texto da anotação' });
  await campo.click();
  await page.keyboard.press('Control+End');
  const salvo = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/notes') && r.request().method() === 'PATCH' && r.ok(),
  );
  await page.keyboard.type(' fim');
  await salvo;
  const [gd] = await adminRest(`notes?id=eq.${g.id}&select=body`);
  expect(gd.body.length).toBe(grande.length + 4);
  expect(gd.body.endsWith(' fim')).toBe(true);
});

// ED6: a gravação leva o hash do texto em que a edição começou; o conflito guardado aparece e mescla
test('conflito: a gravação manda a base e o aviso mescla por bloco', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'um perfil basta');
  test.setTimeout(120_000);
  const { createHash } = await import('node:crypto');
  await signUp(page, testInfo);
  const uid = await userIdOf(page);
  const [nota] = await adminRest('notes', {
    method: 'POST',
    body: JSON.stringify({ user_id: uid, title: 'Mercado', body: 'Comprar pão' }),
  });
  await page.goto(`/nota/${nota.id}`);
  await page.getByRole('button', { name: 'Editar' }).click();
  const campo = page.getByRole('textbox', { name: 'Texto da anotação' });
  await campo.click();
  await page.keyboard.press('Control+End');
  const salvo = page.waitForRequest(
    (r) => r.url().includes('/rest/v1/notes') && r.method() === 'PATCH',
  );
  await page.keyboard.type('\n\nLigar para a Ana');
  const pedido = await salvo;
  const enviado = JSON.parse(pedido.postData() ?? '{}');
  expect(enviado.body_base).toBe(createHash('sha256').update('Comprar pão').digest('hex'));

  // Outro aparelho tinha gravado por cima: o servidor guardou a versão dele
  await adminRest('note_conflicts', {
    method: 'POST',
    body: JSON.stringify({
      note_id: nota.id,
      title: 'Mercado',
      body: 'Comprar pão\n\nMarcar o médico',
    }),
  });
  await page.reload();
  await expect(page.getByTestId('saved-conflict-banner')).toBeVisible({ timeout: 15_000 });
  const gravou = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/notes') && r.request().method() === 'PATCH' && r.ok(),
  );
  await page.getByRole('button', { name: 'Mesclar por bloco' }).click();
  await gravou;
  await expect
    .poll(async () => (await adminRest(`notes?id=eq.${nota.id}&select=body`))[0].body)
    .toBe('Comprar pão\n\nMarcar o médico\n\nLigar para a Ana'); // o bloco da outra entra depois do comum que vinha antes (D348)
  await expect
    .poll(async () => (await adminRest(`note_conflicts?note_id=eq.${nota.id}&select=id`)).length)
    .toBe(0);
});
