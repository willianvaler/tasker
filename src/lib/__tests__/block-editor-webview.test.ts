import { expect, test } from '@jest/globals';

import { editorPageHtml, parseEditorMessage } from '@/lib/block-editor/webview-html';

declare const require: (id: string) => unknown;
const fs = require('fs') as { readFileSync(p: string, e?: string): string | Uint8Array; readdirSync(p: string): string[] };
const crypto = require('crypto') as {
  createHash(a: string): { update(d: string | Uint8Array): void; digest(e: string): string };
};

// O pacote da WebView (R1.4, D373) tem de ser o das fontes de agora: `npm run editor:webview`
test('assets/editor/editor.txt está em dia com src/lib/block-editor', () => {
  const dir = 'src/lib/block-editor';
  const files = [
    ...fs.readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => `${dir}/${f}`).sort(),
    'src/lib/note-format.ts',
  ];
  const h = crypto.createHash('sha256');
  for (const f of files) h.update(fs.readFileSync(f) as Uint8Array);
  const header = (fs.readFileSync('assets/editor/editor.txt', 'utf8') as string).split('\n')[0];
  expect(header).toBe(`/*ql-editor ${h.digest('hex').slice(0, 16)}*/`);
});

test('a página da WebView leva as cores do tema como variáveis', () => {
  const html = editorPageHtml(
    {
      paper: '#F6F2EA',
      surface: '#fff',
      wash: '#000000',
      ink: '#1F1D1A',
      'ink-muted': '#6B655B',
      line: '#E2DBCD',
      accent: '#A94604',
      'accent-soft': '#FBE3D2',
      danger: '#B3261E',
    },
    'editor.js',
  );
  expect(html).toContain('--paper: 246 242 234;');
  expect(html).toContain('--surface: 255 255 255;');
  expect(html).toContain('<script src="editor.js">');
  expect(parseEditorMessage('{"type":"change","markdown":"a"}')).toEqual({ type: 'change', markdown: 'a' });
  expect(parseEditorMessage('nada')).toBeNull();
});
