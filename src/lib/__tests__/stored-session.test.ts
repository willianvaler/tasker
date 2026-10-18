import { describe, expect, test } from '@jest/globals';

import { parseStoredSession } from '../stored-session';

const valid = {
  access_token: 'a.b.c',
  refresh_token: 'r1',
  expires_at: 1,
  user: { id: 'u1' },
};

describe('parseStoredSession', () => {
  test('sessão guardada, mesmo vencida, vale', () => {
    expect(parseStoredSession(JSON.stringify(valid))?.user.id).toBe('u1');
  });
  test('nada guardado ou JSON quebrado: sem sessão', () => {
    expect(parseStoredSession(null)).toBeNull();
    expect(parseStoredSession('')).toBeNull();
    expect(parseStoredSession('{quebrado')).toBeNull();
    expect(parseStoredSession('null')).toBeNull();
  });
  test('sem token de renovação ou sem usuário: sem sessão', () => {
    expect(parseStoredSession(JSON.stringify({ ...valid, refresh_token: undefined }))).toBeNull();
    expect(parseStoredSession(JSON.stringify({ ...valid, user: {} }))).toBeNull();
    expect(parseStoredSession(JSON.stringify({ ...valid, access_token: 5 }))).toBeNull();
  });
});
