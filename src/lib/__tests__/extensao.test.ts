import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { expect, test } from '@jest/globals';

// OB15: a extensão usa uma cópia do conversor; mudou o src/lib/html-markdown.ts, rode npm run extensao
test('extension/converter.js está em dia com src/lib/html-markdown.ts', () => {
  const root = path.join(__dirname, '../../..');
  expect(() =>
    execFileSync('node', ['scripts/extensao.mjs', '--check'], { cwd: root, stdio: 'pipe' }),
  ).not.toThrow();
});
