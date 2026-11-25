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

const NOTE_MAX = 20_000;

test('editor na web: abrir, digitar e colar no teto de 20 mil caracteres', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await signUp(page, testInfo);
  const uid = await userIdOf(page);
  let body = notaGrande(2000);
  body = body.slice(0, NOTE_MAX - 200);
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
  console.log(`BENCH abrir_ms ${abrir}`);
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
  const t2 = Date.now();
  await campo.fill(body);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  console.log(`BENCH colar_${Math.round(body.length / 1000)}kb_ms ${Date.now() - t2}`);
  // O campo corta no teto (maxLength)
  await expect.poll(async () => (await campo.inputValue()).length).toBeLessThanOrEqual(NOTE_MAX);
});
