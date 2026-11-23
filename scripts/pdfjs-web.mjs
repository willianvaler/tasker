// Leitor de PDF na web (CD46): o pdf.js de assets/pdfjs (guardado como .txt para o Metro tratar
// como arquivo no celular, D329) vai para public/pdfjs/ como .js, servido pelo próprio app.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'pdfjs');
mkdirSync(out, { recursive: true });
for (const name of ['pdf.min', 'pdf.worker.min'])
  copyFileSync(join(root, 'assets', 'pdfjs', `${name}.txt`), join(out, `${name}.js`));
