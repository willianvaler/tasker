import { describe, expect, it } from '@jest/globals';

import { parseTimeInput } from '../time';

const today = '2026-10-15';

describe('parseTimeInput', () => {
  it('só o tempo: agora', () =>
    expect(parseTimeInput('45m', today)).toEqual({ minutes: 45, day: null }));
  it('com o dia', () =>
    expect(parseTimeInput('1h30 ontem', today)).toEqual({ minutes: 90, day: '2026-10-14' }));
  it('data no formato curto', () =>
    expect(parseTimeInput('30 14/10', today)).toEqual({ minutes: 30, day: '2026-10-14' }));
  it('dia no futuro não vale', () => expect(parseTimeInput('30 amanhã', today)).toBeNull());
  it('texto que não é tempo', () => expect(parseTimeInput('reunião', today)).toBeNull());
  it('mais de 24 h não', () => expect(parseTimeInput('25h', today)).toBeNull());
});
