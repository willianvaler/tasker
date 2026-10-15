// Gera src/content/help.ts a partir de content/help/<idioma>/*.md (F1, D145). O Metro não
// importa .md; o teste help.test.ts confere que o arquivo gerado está em dia.
//   npm run help:build
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'content/help';
const out = {};
for (const lang of readdirSync(ROOT).sort()) {
  out[lang] = [];
  for (const file of readdirSync(join(ROOT, lang)).filter((f) => f.endsWith('.md')).sort()) {
    const text = readFileSync(join(ROOT, lang, file), 'utf8').trim();
    const [first, ...rest] = text.split('\n');
    out[lang].push({
      // "03-criar-rapido.md" → "criar-rapido" (o número só ordena)
      slug: file.replace(/^\d+-/, '').replace(/\.md$/, ''),
      title: first.replace(/^#\s*/, '').trim(),
      body: rest.join('\n').trim(),
    });
  }
}
const ts = `// GERADO por scripts/help-build.mjs a partir de content/help/. Não edite à mão: npm run help:build\n\nexport type HelpArticle = { slug: string; title: string; body: string };\n\nexport const HELP: Record<string, HelpArticle[]> = ${JSON.stringify(out, null, 2)};\n`;
writeFileSync('src/content/help.ts', ts);
console.log('help:', Object.entries(out).map(([l, a]) => `${l} ${a.length}`).join(', '));
