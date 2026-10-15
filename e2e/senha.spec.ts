import { expect, test } from '@playwright/test';

import { signUp } from './helpers';

// W1: olhinho na senha e "Esqueci minha senha" até entrar com a senha nova (e-mail lido no
// Mailpit do Supabase local).
const MAILPIT = 'http://127.0.0.1:54324/api/v1';

test('esqueci minha senha: link por e-mail, senha nova e entrar', async ({ browser }, testInfo) => {
  test.setTimeout(90_000);
  const first = await browser.newContext();
  const email = await signUp(await first.newPage(), testInfo);
  await first.close();

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  // Olhinho: mostra e esconde
  const password = page.getByPlaceholder('Senha');
  await password.fill('qualquer');
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Mostrar a senha' }).click();
  await expect(password).not.toHaveAttribute('type', 'password');

  await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
  await page.getByPlaceholder('E-mail').fill(email);
  await page.getByRole('button', { name: 'Mandar o link' }).click();
  await expect(page.getByText(/^Se existir uma conta com esse e-mail/)).toBeVisible();

  // O e-mail chega no Mailpit; o link aponta para o endereço público, aqui trocado pelo local
  let link = '';
  await expect
    .poll(
      async () => {
        const list = (await (
          await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:${email}`)}`)
        ).json()) as { messages: { ID: string }[] };
        if (!list.messages?.length) return false;
        const msg = (await (await fetch(`${MAILPIT}/message/${list.messages[0].ID}`)).json()) as {
          HTML: string;
          Text: string;
        };
        link = /https?:\/\/[^\s"'<>]+verify[^\s"'<>]+/.exec(msg.HTML || msg.Text)?.[0] ?? '';
        return !!link;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  link = link
    .replace(/&amp;/g, '&')
    .replace('https://tasker.wavdev.org/supabase', 'http://127.0.0.1:54321');
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Nova senha' })).toBeVisible({ timeout: 20_000 });
  await page.getByPlaceholder('Nova senha').fill('senha-nova-456');
  await page.getByPlaceholder('Repita a senha').fill('senha-nova-456');
  await page.getByRole('button', { name: 'Salvar e entrar' }).click();
  await expect(page.getByRole('heading', { name: /^Olá/ })).toBeVisible({ timeout: 20_000 });
  await context.close();

  // Entra com a senha nova
  const again = await (await browser.newContext()).newPage();
  await again.goto('/');
  await again.getByPlaceholder('E-mail').fill(email);
  await again.getByPlaceholder('Senha').fill('senha-nova-456');
  await again.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(again.getByRole('heading', { name: /^Olá/ })).toBeVisible({ timeout: 20_000 });
});
