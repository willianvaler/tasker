import { expect, test } from '@playwright/test';

import { createPage, signUp } from './helpers';

test('matriz de Eisenhower: quadrantes pela prioridade e data, mover muda a tarefa', async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo);
  await createPage(page, { folder: 'Casa', name: 'Semana', type: 'Lista' });
  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  for (const line of ['Pagar luz !!! hoje', 'Ler livro !!', 'Responder e-mail hoje', 'Ver série']) {
    await input.fill(line);
    await input.press('Enter');
  }
  await expect(page.getByRole('checkbox', { name: 'Concluir Ver série' })).toBeVisible();

  await page.getByRole('tab', { name: 'Matriz' }).click();
  const quadrant = (name: string) => page.getByLabel(`Quadrante ${name}`, { exact: true });
  await expect(quadrant('Fazer').getByText('Pagar luz')).toBeVisible();
  await expect(quadrant('Agendar').getByText('Ler livro')).toBeVisible();
  await expect(quadrant('Delegar').getByText('Responder e-mail')).toBeVisible();
  await expect(quadrant('Eliminar').getByText('Ver série')).toBeVisible();

  await page.getByRole('button', { name: 'Mudar "Ver série" de quadrante' }).click();
  await page.getByRole('menuitem', { name: 'Fazer', exact: true }).click();
  await expect(quadrant('Fazer').getByText('Ver série')).toBeVisible();
  await expect(quadrant('Eliminar').getByText('Ver série')).toHaveCount(0);

  // A página lembra a aba
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Matriz' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Lista' }).click();
  await expect(page.getByRole('checkbox', { name: 'Concluir Ver série' })).toBeVisible();
});
