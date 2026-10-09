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
});
