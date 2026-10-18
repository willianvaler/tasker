import { expect, test } from '@playwright/test';

import { adminRest, signUp, waitForSync } from './helpers';

// V4 §7.1 (D179): servidor fora do ar não tira ninguém da conta. Com o token vencido e o servidor
// respondendo 530 (o erro da Cloudflare com o túnel caído), reabrir o app mantém a pessoa dentro,
// usando o que está no aparelho; quando o servidor volta, o que foi feito sobe sem pedir login.
test('servidor fora do ar: continua logado, usa o aparelho e envia quando ele volta', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await signUp(page, testInfo);
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  const before = `Antes de cair ${testInfo.project.name} ${Date.now()}`;
  await input.fill(`${before} hoje`);
  await input.press('Enter');
  await expect(page.getByRole('checkbox', { name: `Concluir ${before}` })).toBeVisible();
  await waitForSync(page);
  await expect
    .poll(
      async () =>
        (await adminRest(`tasks?title=eq.${encodeURIComponent(before)}&select=id`)).length,
      {
        timeout: 20_000,
      },
    )
    .toBe(1);

  // Servidor fora: Supabase e sync respondem 530
  const down = /:(54321|8095)\//;
  await page.route(down, (route) => route.fulfill({ status: 530, body: 'origin unreachable' }));
  // Token vencido (passou mais de 1 h)
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    if (!key) throw new Error('sem sessão guardada');
    const session = JSON.parse(localStorage.getItem(key) ?? '{}');
    session.expires_at = Math.floor(Date.now() / 1000) - 60;
    localStorage.setItem(key, JSON.stringify(session));
  });
  await page.reload();

  // Continua dentro, com a lista do aparelho
  await expect(input).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('checkbox', { name: `Concluir ${before}` })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar' })).toHaveCount(0);

  // Cria sem servidor
  const during = `Sem servidor ${testInfo.project.name} ${Date.now()}`;
  await input.fill(`${during} hoje`);
  await input.press('Enter');
  await expect(page.getByRole('checkbox', { name: `Concluir ${during}` })).toBeVisible();
  // Recarregar antes de a gravação no aparelho terminar a cancelaria: espera ela estar lá
  await expect
    .poll(() =>
      page.evaluate(async (title) => {
        const db = (
          window as unknown as {
            questlistDb: { getAll: (q: string, p: unknown[]) => Promise<unknown[]> };
          }
        ).questlistDb;
        return (await db.getAll('select id from tasks where title = ?', [title])).length;
      }, during),
    )
    .toBe(1);
  // Reabrir de novo, ainda sem servidor: segue dentro
  await page.reload();
  await expect(page.getByRole('checkbox', { name: `Concluir ${during}` })).toBeVisible({
    timeout: 30_000,
  });

  // O servidor volta: a renovação automática pega um token novo e a fila sobe, sem login
  await page.unroute(down);
  await expect
    .poll(
      async () =>
        (await adminRest(`tasks?title=eq.${encodeURIComponent(during)}&select=id`)).length,
      {
        timeout: 120_000,
        intervals: [2_000],
      },
    )
    .toBe(1);
  await expect(page.getByRole('button', { name: 'Entrar' })).toHaveCount(0);
});
