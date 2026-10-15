import { describe, expect, test } from '@jest/globals';

import {
  describeNotification,
  pushMessages,
} from '../../../supabase/functions/_shared/notification-text';

describe('textos das notificações (tela 🔔 e push)', () => {
  test('atribuída', () => {
    expect(
      describeNotification({
        kind: 'assigned',
        payload: { by: 'Ana', title: 'Carne', task_id: 't1', folder_name: 'Churrasco' },
      }),
    ).toEqual({ text: 'Ana te atribuiu "Carne" em Churrasco', taskId: 't1' });
  });
  test('menção', () => {
    expect(
      describeNotification({
        kind: 'mention',
        payload: { by: 'Bia', title: 'Gelo', task_id: 't2', body: '@ana compra?' },
      }).text,
    ).toBe('Bia te mencionou em "Gelo": @ana compra?');
  });
  test('push abre a tarefa; aviso de entrada abre o projeto', () => {
    const [msg] = pushMessages(
      { kind: 'assigned', payload: { by: 'Ana', title: 'Carne', task_id: 't1' } },
      ['ExponentPushToken[x]'],
    );
    expect(msg).toMatchObject({
      to: 'ExponentPushToken[x]',
      title: 'Questlist',
      data: { url: '/task/t1' },
    });
    expect(
      pushMessages({ kind: 'member_joined', payload: { by: 'Cris', folder_id: 'f1' } }, [
        'a',
        'b',
      ]).map((m) => m.data.url),
    ).toEqual(['/folder/f1', '/folder/f1']);
  });
  test('time: convite, pedido e entrada abrem o time', () => {
    const invited = {
      kind: 'team_invited',
      payload: { by: 'Ana', team_id: 'tm1', team_name: 'Família', token: 'tok' },
    };
    expect(describeNotification(invited)).toEqual({
      text: 'Ana te convidou para o time Família',
      teamInvite: 'tok',
    });
    expect(
      describeNotification({
        kind: 'join_requested',
        payload: { by: 'Caio', team_id: 'tm1', team_name: 'Família' },
      }).text,
    ).toBe('Caio pediu para entrar no time Família');
    expect(pushMessages(invited, ['a'])[0].data.url).toBe('/team-invite/tok');
    expect(
      pushMessages({ kind: 'join_approved', payload: { team_id: 'tm1', team_name: 'Família' } }, [
        'a',
      ])[0].data.url,
    ).toBe('/team/tm1');
  });
  test('fluxo: desbloqueio (com e sem atraso) e pré-requisito reaberto abrem a tarefa', () => {
    expect(
      describeNotification({
        kind: 'task_ready',
        payload: { task_id: 't2', title: 'Acender o fogo', prereq: 'Comprar carvão', lag: 0 },
      }),
    ).toEqual({ text: '"Comprar carvão" foi concluída: já pode "Acender o fogo"', taskId: 't2' });
    expect(
      describeNotification({
        kind: 'task_ready',
        payload: { task_id: 't3', title: 'Assar a carne', prereq: 'Acender o fogo', lag: 30 },
      }).text,
    ).toBe('"Acender o fogo" foi concluída: em 30 min já pode "Assar a carne"');
    expect(
      describeNotification({
        kind: 'prereq_reopened',
        payload: { task_id: 't3', title: 'Assar a carne', prereq: 'Acender o fogo' },
      }).text,
    ).toBe('"Acender o fogo" foi reaberta: "Assar a carne" voltou a esperar');
  });
});

test('lembrete de página recebida abre a página', () => {
  expect(
    describeNotification({
      kind: 'page_reminder',
      payload: { by: 'Carla', page_name: 'Treino A', page_id: 'p1', days: 5 },
    }),
  ).toEqual({ text: 'Carla lembrou você de "Treino A" (5 dias sem registro)', pageId: 'p1' });
});
