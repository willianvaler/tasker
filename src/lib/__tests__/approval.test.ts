import { expect, it } from '@jest/globals';

import { canApprove } from '../approval';

// Mesmos casos do pgTAP aprovacao
it.each([
  [{ approver_id: null, approver_role: null }, 'u', 'editor', true],
  [{ approver_id: null, approver_role: 'manager' }, 'u', 'editor', false],
  [{ approver_id: null, approver_role: 'manager' }, 'u', 'manager', true],
  [{ approver_id: null, approver_role: 'owner' }, 'u', 'manager', false],
  [{ approver_id: 'u', approver_role: null }, 'u', 'editor', true],
  [{ approver_id: 'x', approver_role: null }, 'u', 'owner', false],
] as const)('%o, %s (%s) → %s', (task, user, preset, ok) =>
  expect(canApprove(task, user, preset)).toBe(ok),
);
