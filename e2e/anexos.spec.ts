/// <reference types="node" />
import { expect, test } from '@playwright/test';

import { adminRest, openTab, signUp } from './helpers';

// N2 (D150): anexar imagem (reduzida para WebP no aparelho, com miniatura) e arquivo.
test('anexar foto e arquivo na tarefa', async ({ page }, testInfo) => {
  await signUp(page, testInfo);
  await openTab(page, 'Caixa de entrada');
  const title = `Medir parede ${testInfo.project.name} ${Date.now()}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(title);
  await input.press('Enter');
  await page.getByRole('button', { name: `Detalhes de ${title}` }).click();
  await expect(page.getByText('Nenhum anexo.')).toBeVisible();

  // Uma imagem grande (3000×2000) feita no navegador
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 3000;
    canvas.height = 2000;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = `hsl(${i * 7}, 70%, 50%)`;
      ctx.fillRect((i * 97) % 3000, (i * 53) % 2000, 120, 120);
    }
    return canvas.toDataURL('image/png').split(',')[1];
  });

  let chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Anexar' }).click();
  await page.getByRole('menuitem', { name: 'Foto ou imagem' }).click();
  await (await chooser).setFiles({
    name: 'parede.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  const thumb = page.getByRole('button', { name: 'Abrir parede.png' });
  await expect(thumb).toBeVisible({ timeout: 20_000 });

  // Foi reduzida: lado maior 2048, WebP, com miniatura
  type Row = { width: number; height: number; mime: string; thumb_path: string | null };
  const latest = async () =>
    ((await adminRest(
      `task_attachments?select=*&name=eq.parede.png&order=created_at.desc&limit=1`,
    )) as Row[])[0];
  await expect.poll(latest, { timeout: 20_000 }).toBeTruthy();
  const row = await latest();
  expect(row).toMatchObject({ width: 2048, height: 1365, mime: 'image/webp' });
  expect(row.thumb_path).toContain('.thumb.webp');

  await thumb.click();
  await expect(page.getByText('2048×1365', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar' }).last().click();

  // Arquivo que não é imagem vai como está
  chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Anexar' }).click();
  await page.getByRole('menuitem', { name: 'Arquivo' }).click();
  await (await chooser).setFiles({
    name: 'orcamento.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% teste\n'),
  });
  await expect(page.getByRole('button', { name: 'Abrir orcamento.pdf' })).toBeVisible({
    timeout: 20_000,
  });

  // Remover
  await page.getByRole('button', { name: 'Remover' }).click();
  await page.getByRole('button', { name: 'Remover' }).last().click();
  await expect(page.getByRole('button', { name: 'Abrir orcamento.pdf' })).toHaveCount(0);
});

// N3 (D152): sem internet o anexo espera no aparelho e sobe quando a conexão volta.
test('anexo sem internet entra na fila e sobe depois', async ({ page, context }, testInfo) => {
  const up = await fetch('http://localhost:8095/probes/liveness').then(
    (r) => r.ok,
    () => false,
  );
  test.skip(!up, 'PowerSync local fora do ar (npm run sync:start)');
  test.setTimeout(90_000);
  await signUp(page, testInfo);
  await page.goto('/sync');
  await expect(page.getByText(/No aparelho: \d+ pastas, [1-9]\d* páginas/)).toBeVisible({
    timeout: 20_000,
  });
  await page.goto('/inbox');
  const title = `Recibo ${testInfo.project.name} ${Date.now()}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(title);
  await input.press('Enter');
  await page.getByRole('button', { name: `Detalhes de ${title}` }).click();

  await context.setOffline(true);
  const name = `recibo-${testInfo.project.name}-${Date.now()}.pdf`;
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Anexar' }).click();
  await page.getByRole('menuitem', { name: 'Arquivo' }).click();
  await (await chooser).setFiles({
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% recibo\n'),
  });
  await expect(page.getByText('Na fila: sobe quando a internet voltar.')).toBeVisible({
    timeout: 15_000,
  });
  expect(await adminRest(`task_attachments?select=id&name=eq.${name}`)).toHaveLength(0);

  await context.setOffline(false);
  await expect
    .poll(async () => (await adminRest(`task_attachments?select=id&name=eq.${name}`)).length, {
      timeout: 30_000,
    })
    .toBe(1);
  await expect(page.getByText('Na fila: sobe quando a internet voltar.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: `Abrir ${name}` })).toBeVisible();
});
