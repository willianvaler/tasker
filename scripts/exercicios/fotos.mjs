// AC3.10 (D247, D274): fotos dos exercícios, da free-exercise-db (Unlicense), servidas por nós.
//   node scripts/exercicios/fotos.mjs              # liga, baixa, reduz e sobe tudo
//   node scripts/exercicios/fotos.mjs --se-faltar  # não faz nada se o bucket já está nesta versão
//   node scripts/exercicios/fotos.mjs --so-lista   # só regrava src/lib/gym/exercise-photos.json
//
// Cada exercício da free-exercise-db tem duas fotos (posição inicial e final). O do catálogo é o
// `free-<id>` ou, quando as duas bases juntaram o mesmo exercício (montar-base.mjs), o `mit-…` com o
// mesmo nome e equipamento. Sobe para o bucket público `exercise-photos` em dois tamanhos: 480 px
// (<id>/0.jpg) e a miniatura de 160 px (mini/<id>/0.jpg). O app só precisa saber quais ids têm
// foto (src/lib/gym/exercise-photos.json, versionado); o servidor roda isto no atualizar.sh.
// O Supabase vem do `supabase status` desta pasta (ou SUPABASE_URL + SUPABASE_SECRET_KEY).
import { execSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { EQUIPMENT, nameKey } from './comum.mjs';

const require = createRequire(import.meta.url);
const Jimp = require('jimp-compact');

const root = path.join(import.meta.dirname, '..', '..');
const cache = path.join(root, 'data/exercicios/cache');
const RAW = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main';
const BUCKET = 'exercise-photos';
const SIZES = [
  { prefix: '', width: 480, quality: 72 },
  { prefix: 'mini/', width: 160, quality: 68 },
];
const args = new Set(process.argv.slice(2));

async function loadFree() {
  const file = path.join(cache, 'free.json');
  if (!existsSync(file)) {
    mkdirSync(cache, { recursive: true });
    const res = await fetch(`${RAW}/dist/exercises.json`);
    if (!res.ok) throw new Error(`free-exercise-db: ${res.status}`);
    writeFileSync(file, await res.text());
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** Pares [id do catálogo, exercício da free-exercise-db], na ordem do catálogo. */
function link(base, free) {
  const ids = new Set(base.map((e) => e.id));
  const merged = new Map();
  for (const e of base) {
    if (e.id.startsWith('mit-') && e.sources.includes('free'))
      merged.set(`${nameKey(e.name.en)}|${e.equipment}`, e.id);
  }
  const pairs = [];
  for (const e of free) {
    if (!e.images || e.images.length < 2) continue;
    const id = ids.has(`free-${e.id}`)
      ? `free-${e.id}`
      : merged.get(`${nameKey(e.name)}|${EQUIPMENT[e.equipment ?? 'other'] ?? 'other'}`);
    if (id) pairs.push([id, e]);
  }
  return pairs.sort((a, b) => a[0].localeCompare(b[0]));
}

function supabase() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
    return { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY };
  const status = JSON.parse(
    execSync('npx supabase status -o json', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }),
  );
  return { url: status.API_URL, key: status.SECRET_KEY };
}

async function upload(sb, objectPath, body, type) {
  const res = await fetch(`${sb.url}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: sb.key,
      Authorization: `Bearer ${sb.key}`,
      'Content-Type': type,
      'x-upsert': 'true',
      'Cache-Control': 'max-age=31536000',
    },
    body,
  });
  if (!res.ok) throw new Error(`${objectPath}: ${res.status} ${await res.text()}`);
}

async function original(freeId, i) {
  const file = path.join(cache, 'fotos', freeId, `${i}.jpg`);
  if (existsSync(file)) return readFileSync(file);
  const res = await fetch(`${RAW}/exercises/${freeId}/${i}.jpg`);
  if (!res.ok) throw new Error(`${freeId}/${i}.jpg: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, buffer);
  return buffer;
}

/** Roda `work` em cada item com até `n` ao mesmo tempo. */
async function pool(items, n, work) {
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const item = items[next++];
        await work(item);
        if (++done % 100 === 0) console.log(`  ${done}/${items.length}`);
      }
    }),
  );
}

const base = JSON.parse(readFileSync(path.join(root, 'data/exercicios/base.json'), 'utf8'));
const pairs = link(base, await loadFree());
const ids = pairs.map(([id]) => id);
// No servidor (--se-faltar) a lista não é regravada: é versionada, e mexer nela sujaria a pasta
// para o próximo `git checkout` do atualizar.sh
if (!args.has('--se-faltar')) {
  const listFile = path.join(root, 'src/lib/gym/exercise-photos.json');
  writeFileSync(listFile, `${JSON.stringify(ids, null, 0)}\n`);
  console.log(`exercise-photos.json: ${ids.length} exercícios com foto`);
}
if (args.has('--so-lista')) process.exit(0);

// A versão muda se mudar a lista ou o tamanho das fotos
const version = createHash('sha256')
  .update(JSON.stringify({ ids, SIZES }))
  .digest('hex')
  .slice(0, 16);
const sb = supabase();
if (args.has('--se-faltar')) {
  const res = await fetch(`${sb.url}/storage/v1/object/public/${BUCKET}/versao.txt`);
  if (res.ok && (await res.text()).trim() === version) {
    console.log('Fotos dos exercícios já estão no bucket nesta versão.');
    process.exit(0);
  }
}

console.log(`Subindo ${ids.length * 2 * SIZES.length} fotos para ${sb.url} (${BUCKET})`);
await pool(pairs, 8, async ([id, e]) => {
  for (const i of [0, 1]) {
    const image = await Jimp.read(await original(e.id, i));
    for (const size of SIZES) {
      const out = await image
        .clone()
        .resize(size.width, Jimp.AUTO)
        .quality(size.quality)
        .getBufferAsync(Jimp.MIME_JPEG);
      await upload(sb, `${size.prefix}${id}/${i}.jpg`, out, 'image/jpeg');
    }
  }
});
await upload(sb, 'versao.txt', version, 'text/plain');
console.log(`Pronto (versão ${version}).`);
