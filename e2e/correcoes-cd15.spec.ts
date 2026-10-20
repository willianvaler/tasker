import { expect, test } from '@playwright/test';

import { adminRest, shown, signUp } from './helpers';

// Correções do dono (20/10, noite): página de cards fora da Academia é página comum (CD15),
// "Depende de" à vista no painel e a aba Fluxo em pasta pessoal (CD16), "Mais opções" que recolhe
// de novo (CD17).

async function taskId(title: string) {
  let id: string | undefined;
  await expect
    .poll(
      async () =>
        (id = (await adminRest(`tasks?title=eq.${encodeURIComponent(title)}&select=id`))[0]?.id),
      { timeout: 20_000 },
    )
    .toBeTruthy();
  return id as string;
}

test('cards em pasta pessoal: sem jeito de treino, com Depende de e Fluxo', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'celular', 'Igual nos dois perfis');
  await signUp(page, testInfo);
  const stamp = Date.now();

  // Pasta pessoal com uma página de cards
  await page.getByRole('button', { name: 'Nova pasta' }).first().click();
  const folder = `Casa ${stamp}`;
  await page.getByPlaceholder('Nome (ex.: Academia)').fill(folder);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.getByRole('button', { name: 'Criar a primeira página' }).click();
  await page.getByPlaceholder('Nome (ex.: Treino A)').fill('Churrasco');
  await page.getByRole('radio', { name: /^Cards/ }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { name: 'Churrasco' })).toBeVisible();

  const coal = `Comprar carvão ${stamp}`;
  const fire = `Acender o fogo ${stamp}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  for (const title of [coal, fire]) {
    await input.fill(title);
    await input.press('Enter');
    await expect(shown(page, title)).toBeVisible();
  }
  // CD15: sem séries e fora da Academia, não há Modo Treino
  await expect(page.getByRole('button', { name: 'Iniciar treino' })).toHaveCount(0);

  // CD17: no editor da página, "Mais opções" já vem aberto e recolhe
  await page.getByRole('button', { name: 'Opções da página' }).click();
  await page.getByRole('menuitem', { name: 'Configurar página' }).click();
  const less = page.getByRole('button', { name: 'Menos opções' });
  await expect(less).toHaveAttribute('aria-expanded', 'true');
  await less.click();
  await expect(page.getByRole('button', { name: /^Mais opções/ })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await page.getByRole('button', { name: /^Mais opções/ }).click();
  await expect(page.getByRole('button', { name: 'Menos opções' })).toBeVisible();
  await page.keyboard.press('Escape');

  // CD15 e CD16: o painel não é de exercício e mostra o "Depende de" no modo simples
  const fireId = await taskId(fire);
  await taskId(coal);
  await page.goto(`/task/${fireId}`);
  await expect(page.getByRole('button', { name: /^Mais opções \(data/ })).toHaveCount(0);
  const search = page.getByPlaceholder('Buscar tarefa… (ao criar: ^nome)');
  await search.fill('carvão');
  await page.getByRole('button', { name: `Depender de ${coal}` }).click();
  await expect(shown(page, `Aguardando: ${coal}`)).toBeVisible({ timeout: 15_000 });

  // CD16: a pasta pessoal tem Lista · Fluxo (sem Pessoas)
  await page.goto('/');
  await page.getByRole('link', { name: folder }).first().click();
  await expect(page.getByRole('tab', { name: 'Pessoas' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Fluxo' }).click();
  await expect(shown(page, fire).first()).toBeVisible({ timeout: 15_000 });
});
