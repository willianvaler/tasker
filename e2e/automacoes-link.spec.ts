import { expect, test, type Page } from '@playwright/test';

import { adminRest, signUp } from './helpers';

const userIdOf = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    return JSON.parse(localStorage.getItem(key ?? '') ?? '{}').user?.id as string;
  });

// ESCOPO_V15 (CT4): o link da automação manual sai no editor com o QR, abre /r/<token>, pede
// confirmação, executa (o aviso chega pelo executor) e, revogado, deixa de valer na hora.
test('link por QR e NFC: gerar, abrir, confirmar, executar e revogar', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'o motor é do servidor: basta um perfil');
  test.setTimeout(120_000);
  await signUp(page, testInfo);
  const uid = await userIdOf(page);
  const [rule] = await adminRest('automation_rules', {
    method: 'POST',
    body: JSON.stringify({
      scope: 'pessoal',
      owner_id: uid,
      name: 'Cheguei em casa',
      definition: {
        v: 1,
        gatilho: { tipo: 'manual' },
        passos: [{ tipo: 'notificar', corpo: 'Bem-vinda de volta', canal: 'app' }],
      },
    }),
  });

  await page.goto(`/automacao/${rule.id}`);
  await page.getByRole('button', { name: 'Gerar link' }).click();
  await expect(page.getByRole('img', { name: 'QR do link da automação' })).toBeVisible();
  const url = await page.getByText(/\/r\/[0-9a-f]{64}$/).textContent();
  const path = new URL(url ?? '', 'http://x').pathname;
  await expect(page.getByText(/usado 0 vez/)).toBeVisible();

  // Abrir o link: pede confirmação e executa
  await page.goto(path);
  await expect(page.getByText('Executar esta automação agora?')).toBeVisible();
  await page.getByRole('button', { name: 'Executar', exact: true }).click();
  await expect(page.getByText(/Pronto: a automação foi chamada/)).toBeVisible();
  const avisos = async () =>
    (await adminRest(`notifications?user_id=eq.${uid}&kind=eq.automation&select=payload`)).map(
      (n: { payload: { message: string } }) => n.payload.message,
    );
  await expect.poll(avisos, { timeout: 30_000 }).toEqual(['Bem-vinda de volta']);

  // Revogar: o mesmo link passa a ser inválido
  await page.goto(`/automacao/${rule.id}`);
  await page.getByRole('button', { name: 'Revogar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Revogar' }).click();
  await expect(page.getByText(/Sem link/)).toBeVisible();
  await page.goto(path);
  await expect(page.getByText('Link inválido')).toBeVisible();
});
