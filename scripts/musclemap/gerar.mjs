// AC8.3 (D240): contornos do corpo do MuscleMap (MIT, Melih Colpan; crédito no NOTICE.md) para
// src/lib/gym/body-paths.json. Só os músculos principais (os subgrupos se sobrepõem a eles) e as
// partes do corpo que não são músculo (mãos, pés, cabeça...), para o desenho ficar inteiro.
//   git clone --depth 1 https://github.com/melihcolpan/MuscleMap.git /tmp/MuscleMap
//   node scripts/musclemap/gerar.mjs /tmp/MuscleMap
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const repo = process.argv[2];
if (!repo) throw new Error('Informe a pasta do MuscleMap');
const dir = path.join(repo, 'Sources/MuscleMap/Data');
const SKIP = new Set([
  'upperChest',
  'lowerChest',
  'innerQuad',
  'outerQuad',
  'upperAbs',
  'lowerAbs',
  'frontDeltoid',
  'rearDeltoid',
  'upperTrapezius',
  'lowerTrapezius',
]);
// Quadro de cada figura (BodyPathData.swift): x, y, largura, altura
const VIEW = {
  male: { front: [0, 95, 727, 1280], back: [718, 95, 727, 1280] },
  female: { front: [0, 0, 650, 1450], back: [823, 0, 650, 1450] },
};

function parse(file) {
  const src = readFileSync(path.join(dir, file), 'utf8');
  const parts = [];
  for (const block of src.split('BodyPartPathData(').slice(1)) {
    const slug = /slug:\s*\.(\w+)/.exec(block)?.[1];
    if (!slug || SKIP.has(slug)) continue;
    const d = [...block.matchAll(/"([Mm][^"]+)"/g)].map((m) => m[1]);
    if (d.length) parts.push({ slug, d });
  }
  return parts;
}

const out = {};
for (const sex of ['male', 'female']) {
  const cap = sex === 'male' ? 'Male' : 'Female';
  out[sex] = {
    front: { viewBox: VIEW[sex].front, parts: parse(`${cap}FrontPaths.swift`) },
    back: { viewBox: VIEW[sex].back, parts: parse(`${cap}BackPaths.swift`) },
  };
}
const target = path.join(import.meta.dirname, '..', '..', 'src/lib/gym/body-paths.json');
writeFileSync(target, JSON.stringify(out));
console.log(`${path.relative(process.cwd(), target)}: ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
