// Web Clipper (OB15, D305): gera extension/converter.js a partir de src/lib/html-markdown.ts (o
// conversor testado do app, sem imports) e, com --zip, empacota a extensão em
// public/questlist-clipper.zip, que o deploy publica e o app oferece para baixar.
//   node scripts/extensao.mjs          gera o converter.js
//   node scripts/extensao.mjs --check  falha se o converter.js estiver velho (o teste do Jest usa)
//   node scripts/extensao.mjs --zip    gera e empacota
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { zipSync } from 'fflate';
import ts from 'typescript';

const root = path.join(import.meta.dirname, '..');
const dir = path.join(root, 'extension');
const target = path.join(dir, 'converter.js');

export function buildConverter() {
  const source = readFileSync(path.join(root, 'src/lib/html-markdown.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
  });
  const body = outputText.replace(/^export /gm, '').trim();
  return `// GERADO por scripts/extensao.mjs a partir de src/lib/html-markdown.ts: não edite aqui.
(() => {
${body}
globalThis.questlistHtmlToMarkdown = htmlToMarkdown;
})();
`;
}

const args = process.argv.slice(2);
const code = buildConverter();
if (args.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(target, 'utf8');
  } catch {}
  if (current !== code) {
    console.error('extension/converter.js está velho: rode npm run extensao');
    process.exit(1);
  }
  process.exit(0);
}
writeFileSync(target, code);

if (args.includes('--zip')) {
  const files = {};
  const walk = (folder, prefix = '') => {
    for (const name of readdirSync(folder)) {
      const full = path.join(folder, name);
      if (statSync(full).isDirectory()) walk(full, `${prefix}${name}/`);
      else files[`${prefix}${name}`] = readFileSync(full);
    }
  };
  walk(dir);
  const out = path.join(root, 'public/questlist-clipper.zip');
  writeFileSync(out, zipSync(files, { level: 9 }));
  console.log(`extensão: ${path.relative(root, out)} (${Object.keys(files).length} arquivos)`);
} else {
  console.log('extensão: extension/converter.js gerado');
}
