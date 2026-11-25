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
  const corpo = 'Texto com espaço no fim   \r\nlinha do Windows\n\n<details>html</details> ^bloco1\n\n```desconhecida\nx\n```';
  const [nota] = await adminRest('notes', { method: 'POST', body: JSON.stringify({ user_id: uid, title: 'Antiga', body: corpo }) });

  const escritas: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/rest/v1/notes') && ['PATCH', 'POST', 'PUT'].includes(r.method())) escritas.push(r.method());
  });
  await page.goto(`/nota/${nota.id}`);
  await expect(page.getByRole('heading', { name: 'Antiga' }).or(page.getByRole('textbox', { name: 'Título da anotação' }))).toBeVisible();
  await page.getByRole('button', { name: 'Editar' }).click();
  await expect(page.getByRole('textbox', { name: 'Texto da anotação' })).toBeVisible();
  await page.getByRole('button', { name: 'Visualizar' }).click();
  await page.goto('/notas');
  await page.waitForTimeout(1500);
  expect(escritas).toEqual([]);
  const [depois] = await adminRest(`notes?id=eq.${nota.id}&select=body,updated_at`);
  expect(depois.body).toBe(corpo);

  // Anotação acima do teto antigo (20 mil): 60 mil caracteres abrem, editam e salvam
  const grande = Array.from({ length: 3000 }, (_, i) => `Parágrafo ${i} com texto suficiente.`).join('\n\n');
  const [g] = await adminRest('notes', { method: 'POST', body: JSON.stringify({ user_id: uid, title: 'Grande', body: grande }) });
  await page.goto(`/nota/${g.id}`);
  await page.getByRole('button', { name: 'Editar' }).click();
  const campo = page.getByRole('textbox', { name: 'Texto da anotação' });
  await campo.click();
  await page.keyboard.press('Control+End');
  const salvo = page.waitForResponse((r) => r.url().includes('/rest/v1/notes') && r.request().method() === 'PATCH' && r.ok());
  await page.keyboard.type(' fim');
  await salvo;
  const [gd] = await adminRest(`notes?id=eq.${g.id}&select=body`);
  expect(gd.body.length).toBe(grande.length + 4);
  expect(gd.body.endsWith(' fim')).toBe(true);
});
