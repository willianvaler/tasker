import { describe, expect, test } from '@jest/globals';

import {
  DEFAULT_MAX_DEPTH,
  effectiveMaxDepth,
  HARD_MAX_DEPTH,
  MAX_CHILDREN_PER_TASK,
  MIN_MAX_DEPTH,
} from '../../config/limits';

declare const require: (id: string) => unknown;

describe('limites da árvore', () => {
  test('página vence projeto, projeto vence o padrão', () => {
    expect(effectiveMaxDepth(2, 6)).toBe(2);
    expect(effectiveMaxDepth(null, 6)).toBe(6);
    expect(effectiveMaxDepth(null, null)).toBe(DEFAULT_MAX_DEPTH);
  });

  test('é igual ao public.tree_limits() do banco', () => {
    const fs = require('fs') as {
      readFileSync: (p: string, e: string) => string;
      readdirSync: (p: string) => string[];
    };
    const dir = 'supabase/migrations';
    const sql = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => fs.readFileSync(`${dir}/${f}`, 'utf8'))
      .filter((s) => s.includes('function public.tree_limits()'))
      .pop();
    const json = /select '(\{[^']*\})'::jsonb/.exec(sql ?? '')?.[1];
    expect(JSON.parse(json ?? '{}')).toEqual({
      default_max_depth: DEFAULT_MAX_DEPTH,
      min_max_depth: MIN_MAX_DEPTH,
      hard_max_depth: HARD_MAX_DEPTH,
      max_children_per_task: MAX_CHILDREN_PER_TASK,
    });
  });
});
