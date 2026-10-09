import { describe, expect, it } from '@jest/globals';

import { cn } from '../cn';

describe('cn', () => {
  it('junta classes e ignora valores vazios', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
  });
});
