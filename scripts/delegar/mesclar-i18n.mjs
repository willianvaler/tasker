// Aplica um fragmento { "pt-BR": {secao: {...}}, "en": {...}, "es": {...} } nos locales.
// Idempotente: as chaves do fragmento sobrescrevem; o resto do arquivo fica como está.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const [frag, dir = 'src/i18n/locales'] = process.argv.slice(2);
if (!existsSync(frag) || !readFileSync(frag, 'utf8').trim()) process.exit(0);
const data = JSON.parse(readFileSync(frag, 'utf8'));
const merge = (a, b) => {
  for (const [k, v] of Object.entries(b))
    a[k] = v && typeof v === 'object' && a[k] && typeof a[k] === 'object' ? merge(a[k], v) : v;
  return a;
};
for (const lang of ['pt-BR', 'en', 'es']) {
  if (!data[lang]) { console.error(`fragmento sem o idioma ${lang}`); process.exit(1); }
  const file = `${dir}/${lang}.json`;
  writeFileSync(file, JSON.stringify(merge(JSON.parse(readFileSync(file, 'utf8')), data[lang]), null, 2) + '\n');
}
