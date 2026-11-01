import { expect, test, type Page } from '@playwright/test';

import { openTab, signUp } from './helpers';

// OB1 e OB2 (D286): links [[...]] com autocomplete, "Citado em", link para o que ainda não existe
// e menções sem link.
async function newNote(page: Page, desktop: boolean, title: string, body: string) {
  if (desktop) await page.getByRole('button', { name: 'Nova anotação' }).first().click();
  else {
    await page.getByRole('button', { name: 'Novo', exact: true }).last().click();
    await page.getByRole('menuitem', { name: 'Anotação' }).click();
  }
  await expect(page.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue('');
  await page.getByRole('textbox', { name: 'Título da anotação' }).fill(title);
  if (body) await page.getByRole('textbox', { name: 'Texto da anotação' }).fill(body);
  // Salva sozinho (800 ms) e dá tempo de gravar antes de a página recarregar
  await page.waitForTimeout(2500);
}

test('links entre anotações: [[, Citado em, criar pelo link e ligar menção', async ({
  page,
}, testInfo) => {
  const desktop = testInfo.project.name === 'desktop';
  const stamp = `${testInfo.project.name}${Date.now()}`;
  const recipes = `Receitas ${stamp}`;
  const idea = `Ideia ${stamp}`;
  await signUp(page, testInfo);

  await newNote(page, desktop, recipes, '## Bolo\nfarinha e ovos');
  await page.goto('/');
  await newNote(page, desktop, `Plano ${stamp}`, '');
  const body = page.getByRole('textbox', { name: 'Texto da anotação' });
  await body.pressSequentially('ver [[Receitas');
  const suggestions = page.getByRole('list', { name: 'Sugestões de link' });
  await suggestions.getByRole('button', { name: `Ligar a ${recipes}` }).click();
  await expect(body).toHaveValue(new RegExp(`^ver \\[\\[${recipes}\\|n:[0-9a-f-]{36}\\]\\]$`));
  // Link para o que ainda não existe: a última opção
  await body.press('End');
  await body.pressSequentially(` e [[${idea}`);
  await suggestions.getByRole('button', { name: `Link para "${idea}" (ainda não existe)` }).click();
  await expect(body).toHaveValue(new RegExp(`\\[\\[${idea}\\]\\]$`));
  await page.waitForTimeout(1200);

  // Formatada: o link abre a outra anotação, que mostra quem a cita
  await page.getByRole('button', { name: 'Visualizar' }).click();
  await expect(page.getByRole('list', { name: 'Links que saem' })).toContainText(recipes);
  await page.getByRole('link', { name: recipes }).first().click();
  await expect(page.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue(recipes);
  const cited = page.getByRole('list', { name: 'Citado em' });
  await expect(cited).toContainText(`Plano ${stamp}`, { timeout: 15_000 });
  await expect(cited).toContainText(`ver ${recipes} e ${idea}`);

  // Tocar no link apagado cria a anotação com o título, e a origem passa a ter o id
  await cited.getByRole('link', { name: new RegExp(`Plano ${stamp}`) }).click();
  await expect(page.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue(
    `Plano ${stamp}`,
  );
  await page.getByRole('link', { name: idea }).first().click();
  await expect(page.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue(idea);
  await expect(page.getByRole('list', { name: 'Citado em' })).toContainText(`Plano ${stamp}`, {
    timeout: 15_000,
  });

  // Menção sem link: outra anotação que escreve o título sem [[ ]]
  await page.goto('/');
  await newNote(page, desktop, `Diário ${stamp}`, `hoje li ${recipes} de novo`);
  await page.goto('/notas');
  await page
    .getByRole('link', { name: new RegExp(`^${recipes}`) })
    .last()
    .click();
  const mentions = page.getByRole('list', { name: 'Menções sem link' });
  await expect(mentions).toContainText(`Diário ${stamp}`);
  await mentions.getByRole('button', { name: `Ligar a menção em Diário ${stamp}` }).click();
  await expect(mentions).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Citado em' })).toContainText(`Diário ${stamp}`, {
    timeout: 15_000,
  });
});

test('link na descrição da tarefa: autocomplete, Links que saem e Citado em na anotação', async ({
  page,
}, testInfo) => {
  const desktop = testInfo.project.name === 'desktop';
  const stamp = `${testInfo.project.name}${Date.now()}`;
  const note = `Manual ${stamp}`;
  await signUp(page, testInfo);
  await newNote(page, desktop, note, 'como usar');

  await openTab(page, 'Caixa de entrada');
  const task = `Montar ${stamp}`;
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill(task);
  await input.press('Enter');
  await page.getByRole('button', { name: `Detalhes de ${task}` }).click();
  await page.getByRole('button', { name: 'Adicionar descrição' }).click();
  const description = page.getByRole('textbox', { name: 'Descrição' });
  await description.pressSequentially('seguir [[Manual');
  await page
    .getByRole('list', { name: 'Sugestões de link' })
    .getByRole('button', { name: `Ligar a ${note}` })
    .click();
  await expect(description).toHaveValue(
    new RegExp(`^seguir \\[\\[${note}\\|n:[0-9a-f-]{36}\\]\\]$`),
  );
  await page.getByRole('textbox', { name: 'Título', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Links que saem' })).toContainText(note);

  // A anotação mostra a tarefa no "Citado em", e tocar volta para a tarefa
  await page
    .getByRole('list', { name: 'Links que saem' })
    .getByRole('link', { name: note })
    .click();
  await expect(page.getByRole('textbox', { name: 'Título da anotação' })).toHaveValue(note);
  const cited = page.getByRole('list', { name: 'Citado em' });
  await expect(cited).toContainText(task, { timeout: 15_000 });
  await expect(cited).toContainText(`seguir ${note}`);
});
