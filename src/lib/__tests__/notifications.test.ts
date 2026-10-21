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
  test('lembrete de tarefa com horário', () => {
    expect(
      describeNotification({
        kind: 'task_reminder',
        payload: {
          title: 'Ligar para o banco',
          task_id: 't9',
          due_date: '2026-10-20',
          due_time: '15:00',
        },
      }),
    ).toEqual({ text: '⏰ 20/10 15:00 · Ligar para o banco', taskId: 't9' });
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

test('reação: na conclusão e no comentário, abre a tarefa', () => {
  const payload = { by: 'Bia', emoji: '🔥', title: 'Carvão', task_id: 't1' };
  expect(describeNotification({ kind: 'reaction', payload })).toEqual({
    text: 'Bia reagiu 🔥 a "Carvão"',
    taskId: 't1',
  });
  expect(
    describeNotification({ kind: 'reaction', payload: { ...payload, comment_id: 'c1' } }, 'en')
      .text,
  ).toBe('Bia reacted 🔥 to your comment on "Carvão"');
});

test('amizade abre a tela Amigos', () => {
  const n = { kind: 'friend_request', payload: { by: 'Bia', user_id: 'u' } };
  expect(describeNotification(n)).toEqual({ text: 'Bia pediu amizade', url: '/amigos' });
  expect(pushMessages(n, ['a'])[0].data.url).toBe('/amigos');
});

test('lembrete de página recebida abre a página', () => {
  expect(
    describeNotification({
      kind: 'page_reminder',
      payload: { by: 'Carla', page_name: 'Treino A', page_id: 'p1', days: 5 },
    }),
  ).toEqual({ text: 'Carla lembrou você de "Treino A" (5 dias sem registro)', pageId: 'p1' });
});

describe('idioma das notificações (F3)', () => {
  const assigned = {
    kind: 'assigned',
    payload: { by: 'Ana', title: 'Carne', task_id: 't1', folder_name: 'Churrasco' },
  };
  test('inglês e espanhol', () => {
    expect(describeNotification(assigned, 'en').text).toBe('Ana assigned you "Carne" in Churrasco');
    expect(describeNotification(assigned, 'es').text).toBe('Ana te asignó "Carne" en Churrasco');
    expect(describeNotification({ kind: 'x', payload: {} }, 'en').text).toBe('News');
    expect(
      describeNotification({ kind: 'member_joined', payload: { folder_name: 'Casa' } }, 'es').text,
    ).toBe('Alguien se unió en Casa');
  });
  test('idioma desconhecido cai no português', () => {
    expect(describeNotification(assigned, 'fr').text).toBe('Ana te atribuiu "Carne" em Churrasco');
  });
  test('lembrete: data no formato do idioma', () => {
    const reminder = {
      kind: 'task_reminder',
      payload: { title: 'Banco', task_id: 't9', due_date: '2026-10-20', due_time: '15:00' },
    };
    expect(describeNotification(reminder, 'en').text).toBe('⏰ 10/20 15:00 · Banco');
    expect(describeNotification(reminder, 'es').text).toBe('⏰ 20/10 15:00 · Banco');
  });
  test('push: cada aparelho no idioma dele; sem idioma, o do perfil', () => {
    const messages = pushMessages(
      assigned,
      [
        { token: 'a', locale: 'en' },
        { token: 'b', locale: null },
      ],
      'es',
    );
    expect(messages.map((m) => m.body)).toEqual([
      'Ana assigned you "Carne" in Churrasco',
      'Ana te asignó "Carne" en Churrasco',
    ]);
  });
  test('todo tipo tem texto nos três idiomas', () => {
    const kinds = [
      'assigned',
      'mention',
      'member_joined',
      'team_invited',
      'team_joined',
      'join_requested',
      'join_approved',
      'task_ready',
      'prereq_reopened',
      'automation',
      'page_reminder',
      'workout_invite',
      'challenge_started',
      'challenge_finished',
      'reaction',
      'friend_request',
      'friend_accepted',
      'added_to_group',
      'workout_reminder',
    ];
    const payload = {
      by: 'Ana',
      title: 'T',
      body: 'oi',
      days: 2,
      lag: 5,
      count: 2,
      task_id: 'x',
      team_name: 'Família',
      prereq: 'P',
      page_name: 'Treino',
      name: 'Desafio',
      place: 1,
      emoji: '👏',
      group_name: 'Churrasco',
    };
    for (const locale of ['pt-BR', 'en', 'es'])
      for (const kind of kinds) {
        const { text } = describeNotification({ kind, payload }, locale);
        expect(text).not.toContain('undefined');
        expect(text.length).toBeGreaterThan(3);
      }
  });
});
