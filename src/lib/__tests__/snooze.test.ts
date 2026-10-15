import { expect, it } from '@jest/globals';

import { snoozeDate } from '../snooze';

// 15/10/2026 é quinta-feira
it.each([
  ['tomorrow', '2026-10-16'],
  ['weekend', '2026-10-17'],
  ['nextWeek', '2026-10-19'],
] as const)('%s → %s', (target, date) => expect(snoozeDate(target, '2026-10-15')).toBe(date));

it('no sábado, "fim de semana" é o próximo', () =>
  expect(snoozeDate('weekend', '2026-10-17')).toBe('2026-10-24'));
