import { describe, expect, test } from '@jest/globals';

import { friendQuery } from '../friends';

describe('friendQuery', () => {
  test('e-mail', () => expect(friendQuery(' Ana@Teste.com ')).toEqual({ email: 'Ana@Teste.com' }));
  test('nick com ou sem @, em minúsculas', () => {
    expect(friendQuery('@Ana.Souza')).toEqual({ username: 'ana.souza' });
    expect(friendQuery('bia_2')).toEqual({ username: 'bia_2' });
  });
  test('nem um nem outro', () => {
    expect(friendQuery('ab')).toBeNull();
    expect(friendQuery('ana souza')).toBeNull();
    expect(friendQuery('')).toBeNull();
  });
});
