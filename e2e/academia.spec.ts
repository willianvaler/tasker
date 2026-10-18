import { expect, test, type Page } from '@playwright/test';

import { openTab, signUp } from './helpers';

const QUESTION = 'Vai usar o Questlist para treinar?';

async function openProfile(page: Page, desktop: boolean) {
  if (desktop) {
    await page.getByRole('navigation').getByRole('link', { name: 'Perfil' }).click();
    return;
  }
  // No celular a página do treino abre por cima das abas
  await page.getByRole('button', { name: 'Voltar' }).first().click();
  await openTab(page, 'Perfil');
}

// V6 §15.1 e §15.2 (AC1): pergunta no primeiro acesso, bloco Academia com "Novo treino",
// subir/descer pasta e esconder o bloco pelo Perfil.
test('modo academia: pergunta, Academia, novo treino, mover e esconder', async ({
  page,
}, testInfo) => {
  const desktop = testInfo.project.name === 'desktop';
  await signUp(page, testInfo);
  await openTab(page, 'Início');

  await expect(page.getByRole('heading', { name: QUESTION })).toBeVisible();
  const answer = page.waitForResponse((r) => r.url().includes('/rpc/set_gym_mode'));
  await page.getByRole('button', { name: 'Sim, vou treinar' }).click();
  await answer;
  await expect(page.getByRole('heading', { name: QUESTION })).toHaveCount(0);

  // Novo treino: na barra lateral (computador) ou na aba Pastas (celular)
  if (desktop) {
    await page.getByRole('navigation').getByRole('button', { name: 'Novo treino' }).first().click();
  } else {
    await openTab(page, 'Pastas');
    await page.getByRole('button', { name: 'Novo treino' }).first().click();
  }
  const name = `Treino A ${testInfo.project.name} ${Date.now()}`;
  await page.getByPlaceholder('Nome do treino (ex.: Treino A)').fill(name);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  if (desktop) {
    await expect(page.getByRole('navigation').getByRole('link', { name })).toBeVisible();
  }

  // Duas pastas: a segunda sobe pelo menu (sem arrastar)
  if (desktop) {
    for (const folder of ['Primeira', 'Segunda']) {
      await page.getByRole('navigation').getByRole('button', { name: 'Nova pasta' }).click();
      await page.getByPlaceholder('Nome (ex.: Academia)').fill(folder);
      await page.getByRole('button', { name: 'Salvar' }).click();
      await expect(page.getByRole('heading', { name: folder })).toBeVisible();
    }
    const nav = page.getByRole('navigation');
    const links = () => nav.getByRole('link', { name: /^(Primeira|Segunda)$/ }).allTextContents();
    await expect.poll(links).toEqual(['Primeira', 'Segunda']);
    await nav.getByRole('button', { name: 'Opções de Segunda' }).click();
    await page.getByRole('menuitem', { name: 'Mover para cima' }).click();
    await expect.poll(links).toEqual(['Segunda', 'Primeira']);
  }

  // Esconder o bloco Academia e desligar o modo pelo Perfil
  await openProfile(page, desktop);
  await page.getByRole('button', { name: 'Esconder Academia' }).click();
  if (desktop) {
    await expect(
      page.getByRole('navigation').getByRole('button', { name: 'Novo treino' }),
    ).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Mostrar Academia' }).click();
  const off = page.waitForResponse((r) => r.url().includes('/rpc/set_gym_mode'));
  await page.getByRole('switch', { name: 'Modo academia' }).click();
  await off;
  // Desligado, a pasta Academia volta para Pastas (nada some)
  if (desktop) {
    await expect(
      page.getByRole('navigation').getByRole('link', { name: 'Academia' }),
    ).toBeVisible();
  } else {
    await openTab(page, 'Pastas');
    await expect(page.getByRole('link', { name: /Academia/ }).first()).toBeVisible();
  }
});
