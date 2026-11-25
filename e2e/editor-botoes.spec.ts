import { expect, test, type Page } from '@playwright/test';

import { adminRest, signUp } from './helpers';

// ED4 (ESCOPO_V16): botão na anotação roda a ação do V14 (com histórico); dispositivo pede
// confirmação; dado sensível não roda. Precisa do executor ligado (`app_config.automation_url`).

const userIdOf = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    return JSON.parse(localStorage.getItem(key ?? '') ?? '{}').user?.id as string;
  });

test('botões na anotação', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'um perfil basta');
  test.setTimeout(120_000);
  await signUp(page, testInfo);
  const uid = await userIdOf(page);
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e4)}`;
  const botao = (o: unknown) => '```questlist-button\n' + JSON.stringify(o) + '\n```';
  const corpo = [
    'Pauta',
    botao({
      rotulo: 'Criar a ata',
      acao: { tipo: 'criar_tarefa', titulo: 'Ata de {{evento.titulo}}' },
    }),
    botao({
      rotulo: 'Ligar a luz',
      acao: { tipo: 'comandar_dispositivo', dispositivo: 'x', comando: 'ligar' },
    }),
    botao({ rotulo: 'Peso', acao: { tipo: 'notificar', titulo: '{{saude.peso}}' } }),
  ].join('\n\n');
  const [nota] = await adminRest('notes', {
    method: 'POST',
    body: JSON.stringify({ user_id: uid, title: `Reunião ${stamp}`, body: corpo }),
  });
  await page.goto(`/nota/${nota.id}`);

  const rodou = page.waitForResponse((r) => r.url().includes('note_button_run') && r.ok());
  await page.getByRole('button', { name: 'Criar a ata' }).click();
  await rodou;
  await expect(page.getByText('Feito: Criar a ata')).toBeVisible();
  await expect
    .poll(
      async () =>
        (await adminRest(`tasks?created_by=eq.${uid}&title=eq.Ata de Reunião ${stamp}&select=id`))
          .length,
      {
        timeout: 30_000,
      },
    )
    .toBe(1);
  // O histórico fica nas execuções da regra "Botões das anotações"
  const [regra] = await adminRest(
    `automation_rules?owner_id=eq.${uid}&definition->>sistema=eq.botoes&select=id`,
  );
  await expect
    .poll(
      async () =>
        (await adminRest(`automation_runs?rule_id=eq.${regra.id}&select=status`))[0]?.status,
      { timeout: 30_000 },
    )
    .toBe('ok');

  // Dispositivo: pede confirmação antes
  await page.getByRole('button', { name: 'Ligar a luz' }).click();
  await expect(
    page.getByText('Este botão mexe num webhook ou num dispositivo. Rodar agora?'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();

  // Dado sensível: não roda
  await expect(page.getByRole('button', { name: 'Peso' })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText(/lê dado sensível/)).toBeVisible();
});
