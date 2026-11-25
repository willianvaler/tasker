import { expect, test, type Page } from '@playwright/test';

import { notaGrande } from '../src/lib/__tests__/fixtures/notas-geradas';
import { adminRest, signUp } from '../e2e/helpers';

// ED0/ED5 (ESCOPO_V16): abrir, digitar e colar na web, no teto de hoje (20 mil caracteres por
// anotação, NOTE_MAX). Os números saem no console como "BENCH nome valor".

const userIdOf = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    return JSON.parse(localStorage.getItem(key ?? '') ?? '{}').user?.id as string;
  });

const NOTE_MAX = 1_000_000;

for (const [nome, blocosN] of [
  ['5 mil blocos', 5000],
  ['20 mil palavras', 2900],
] as const)
test(`editor na web: abrir e digitar (${nome})`, async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await signUp(page, testInfo);
  const uid = await userIdOf(page);
  const body = notaGrande(blocosN);
  const blocos = body.split('\n\n').length;
  const palavras = body.split(/\s+/).length;
  const [nota] = await adminRest('notes', {
    method: 'POST',
    body: JSON.stringify({ user_id: uid, title: 'Bancada', body }),
  });
  console.log(`BENCH tamanho ${body.length} caracteres, ${blocos} blocos, ${palavras} palavras`);

  // Abrir (leitura) e passar para edição
  const t0 = Date.now();
  await page.goto(`/nota/${nota.id}`);
  await expect(page.getByText('Seção 0', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  const abrir = Date.now() - t0;
  const t1 = Date.now();
  await page.getByRole('button', { name: 'Editar' }).click();
  const campo = page.getByRole('textbox', { name: 'Texto da anotação' });
  await expect(campo).toBeVisible();
  const editar = Date.now() - t1;
  console.log(`BENCH [${nome}] abrir_ms ${abrir}`);
  console.log(`BENCH abrir_para_editavel_ms ${editar}`);

  // Digitar: tempo do evento de entrada até o próximo quadro, por tecla
  await campo.click();
  await page.keyboard.press('Control+End');
  await page.evaluate(() => {
    const w = window as unknown as { __lat: number[] };
    w.__lat = [];
    document.addEventListener(
      'input',
      () => {
        const t = performance.now();
        requestAnimationFrame(() => requestAnimationFrame(() => w.__lat.push(performance.now() - t)));
      },
      true,
    );
  });
  for (const c of 'bancada de digitação com texto grande '.slice(0, 40)) await page.keyboard.type(c);
  await page.waitForTimeout(300);
  const lat = (await page.evaluate(() => (window as unknown as { __lat: number[] }).__lat)).sort((a, b) => a - b);
  const p95 = lat[Math.floor(lat.length * 0.95) - 1] ?? lat.at(-1);
  console.log(`BENCH digitar_p95_ms ${Math.round(p95 ?? -1)} (n=${lat.length}, mediana ${Math.round(lat[Math.floor(lat.length / 2)] ?? -1)})`);

  // Colar: o texto inteiro de uma vez num campo vazio
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  const mega = 'Texto colado de exemplo com acentuação. '.repeat(Math.floor(1_000_000 / 41));
  const t2 = Date.now();
  await campo.fill(mega);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  console.log(`BENCH colar_${Math.round(mega.length / 1000)}kb_ms ${Date.now() - t2}`);
  // O campo corta no teto (maxLength)
  await expect.poll(async () => (await campo.inputValue()).length).toBeLessThanOrEqual(NOTE_MAX);
});

// Sincronizar uma edição entre dois aparelhos online (dois navegadores na mesma conta), pelo PowerSync
test('sync de uma edição entre dois aparelhos', async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  const ps = await fetch('http://127.0.0.1:8095/probes/liveness').catch(() => null);
  test.skip(!ps?.ok, 'precisa do PowerSync local (npm run sync:start)');
  const email = await signUp(page, testInfo);
  const uid = await userIdOf(page);
  const [nota] = await adminRest('notes', {
    method: 'POST',
    body: JSON.stringify({ user_id: uid, title: 'Sync', body: 'Começo' }),
  });
  const ctx2 = await browser.newContext();
  const outro = await ctx2.newPage();
  await outro.goto('/');
  await outro.getByPlaceholder('E-mail').fill(email);
  await outro.getByPlaceholder('Senha').fill('senha-forte-123');
  await outro.getByRole('button', { name: 'Entrar', exact: true }).last().click();
  await expect(outro.getByRole('heading', { name: /^Hoje/ })).toBeVisible({ timeout: 30_000 });
  await outro.goto(`/nota/${nota.id}`);
  await expect(outro.getByText('Começo').first()).toBeVisible({ timeout: 60_000 });
  await page.goto(`/nota/${nota.id}`);
  await page.getByRole('button', { name: 'Editar' }).click();
  const campo = page.getByRole('textbox', { name: 'Texto da anotação' });
  await campo.click();
  await page.keyboard.press('Control+End');
  const marca = `SYNC${Date.now()}`;
  await page.keyboard.type(` ${marca}`);
  // A gravação sai 800 ms depois de parar de digitar (o editor); o relógio conta dali
  const t0 = Date.now() + 800;
  await expect(outro.getByText(new RegExp(marca)).first()).toBeVisible({ timeout: 30_000 });
  console.log(`BENCH sync_dois_aparelhos_ms ${Date.now() - t0}`);
  await ctx2.close();
});
