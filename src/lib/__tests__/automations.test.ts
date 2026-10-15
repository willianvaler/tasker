import { expect, it } from '@jest/globals';

import { ruleParams } from '../automations';

const base = { trigger: 'task_done', pageId: null } as const;

it.each([
  [{ action: 'create_task', title: ' Limpar ' }, { title: 'Limpar' }],
  [{ action: 'create_task', title: '' }, null],
  [{ action: 'assign' }, null],
  [{ action: 'notify' }, { to: 'creator' }],
  [{ action: 'add_label', label: '#Urgente' }, { label: 'urgente' }],
  [{ action: 'move', targetPageId: 'p2' }, { page_id: 'p2' }],
  [{ action: 'rest_timer', seconds: 2 }, null],
] as const)('%o → %o', (draft, params) =>
  expect(ruleParams({ ...base, ...draft })).toEqual(params),
);
