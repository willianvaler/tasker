// Empacota o editor de blocos para a WebView do celular (R1.4, D373): src/lib/block-editor/
// webview-entry.ts vira assets/editor/editor.txt (.txt para o Metro tratar como arquivo, como o
// pdf.js, D329). A primeira linha guarda o hash das fontes; o teste block-editor-webview acusa o
// pacote velho. Rode `npm run editor:webview` depois de mexer em src/lib/block-editor/.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export function sourcesHash() {
  const dir = join(root, 'src/lib/block-editor');
  const files = [
    ...readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => join(dir, f)).sort(),
    join(root, 'src/lib/note-format.ts'),
  ];
  const h = createHash('sha256');
  for (const f of files) h.update(readFileSync(f));
  return h.digest('hex').slice(0, 16);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = await build({
    entryPoints: [join(root, 'src/lib/block-editor/webview-entry.ts')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['chrome80'],
    write: false,
    legalComments: 'none',
  });
  const code = out.outputFiles[0].text;
  writeFileSync(join(root, 'assets/editor/editor.txt'), `/*ql-editor ${sourcesHash()}*/\n${code}`);
  console.log(`assets/editor/editor.txt: ${Math.round(code.length / 1024)} KB`);
}
