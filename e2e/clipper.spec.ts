import { expect, test, type Page } from '@playwright/test';

import { signUp } from './helpers';

// OB15 (ESCOPO_V11, D305): a extensão do navegador abre /clip#<recorte>; um toque salva como
// anotação, com a origem nas propriedades. Sem login, o recorte espera a pessoa entrar. O
// "Compartilhar" do celular (PB8) salva do mesmo jeito.
const fragment = (clip: object) => Buffer.from(JSON.stringify(clip)).toString('base64url');

async function saveClip(page: Page, title: string) {
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar como anotação' }).click();
  await expect(page.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue(title);
}

test('web clipper: recorte vira anotação, também depois de entrar', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'a extensão é do computador');
  const stamp = Date.now();
  const email = await signUp(page, testInfo);

  await page.goto(
    `/clip#${fragment({
      title: `Pão de queijo ${stamp}`,
      url: `https://exemplo.com/pao-${stamp}`,
      markdown: `## Ingredientes\n\n- polvilho ${stamp}\n- queijo`,
      author: 'Ana',
      selection: false,
    })}`,
  );
  await expect(page.getByText('exemplo.com · Ana · página inteira')).toBeVisible();
  await saveClip(page, `Pão de queijo ${stamp}`);
  // Anotação com texto abre lendo: o Markdown aparece formatado
  await expect(page.getByRole('navigation', { name: 'Sumário' })).toContainText('Ingredientes');
  await expect(page.getByText(`polvilho ${stamp}`)).toBeVisible();
  await expect(page.getByText(`https://exemplo.com/pao-${stamp}`).first()).toBeVisible();
  await expect(page.getByRole('link', { name: '#recortes' })).toBeVisible();

  // Sem login: o recorte espera a pessoa entrar e a tela dele abre depois
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/clip#${fragment({ title: `Depois ${stamp}`, markdown: 'texto' })}`);
  await page.getByPlaceholder('E-mail').fill(email);
  await page.getByPlaceholder('Senha').fill('senha-forte-123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await saveClip(page, `Depois ${stamp}`);

  // Pelo Compartilhar (celular ou web instalada): o link vira uma anotação com a origem
  await page.goto(
    `/compartilhar?title=${encodeURIComponent(`Artigo ${stamp}`)}&text=${encodeURIComponent(
      `Vale ler https://exemplo.com/artigo-${stamp}`,
    )}`,
  );
  await page.getByRole('button', { name: 'Salvar como anotação' }).click();
  await expect(page.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue(
    `Artigo ${stamp}`,
  );
  await expect(page.getByText('Vale ler', { exact: true })).toBeVisible();
  await expect(page.getByText(`https://exemplo.com/artigo-${stamp}`).first()).toBeVisible();
});
