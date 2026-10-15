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
