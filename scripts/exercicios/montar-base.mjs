// AC3.1 (D235): monta data/exercicios/base.json a partir de duas bases livres.
//   - hasaneyldrm/exercises-dataset (MIT): nome, parte do corpo, alvo, sinergistas, equipamento e
//     instruções em en e es. As fotos e GIFs são © Gym visual e NÃO entram (V6 §0).
//   - yuhonas/free-exercise-db (Unlicense): só os dados técnicos (nível, mecânica, força, músculos,
//     categoria). As instruções dela ficam de fora: a origem dos textos é duvidosa (V6 §14.1).
// Exercício igual nas duas (mesmo nome normalizado e equipamento) vira um só. Rode com:
//   node scripts/exercicios/montar-base.mjs   (baixa para data/exercicios/cache/, não versionado)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { EQUIPMENT, nameKey } from './comum.mjs';

const root = path.join(import.meta.dirname, '..', '..');
const cache = path.join(root, 'data/exercicios/cache');
const SOURCES = {
  mit: 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json',
  free: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json',
};

async function load(name) {
  mkdirSync(cache, { recursive: true });
  const file = path.join(cache, `${name}.json`);
  if (!existsSync(file)) {
    const res = await fetch(SOURCES[name]);
    if (!res.ok) throw new Error(`${name}: ${res.status}`);
    writeFileSync(file, await res.text());
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

const BODY_PART = {
  'upper arms': 'arms', 'lower arms': 'arms', 'upper legs': 'legs', 'lower legs': 'legs', back: 'back',
  waist: 'core', chest: 'chest', shoulders: 'shoulders', cardio: 'cardio', neck: 'neck',
};
const MUSCLE = {
  abs: 'abs', abdominals: 'abs', pectorals: 'chest', chest: 'chest', biceps: 'biceps', triceps: 'triceps',
  delts: 'shoulders', shoulders: 'shoulders', 'upper back': 'upper_back', 'middle back': 'upper_back',
  lats: 'lats', traps: 'traps', spine: 'lower_back', 'lower back': 'lower_back', glutes: 'glutes',
  quads: 'quads', quadriceps: 'quads', hamstrings: 'hamstrings', calves: 'calves', adductors: 'adductors',
  abductors: 'abductors', forearms: 'forearms', neck: 'neck', 'levator scapulae': 'neck',
  'serratus anterior': 'serratus', obliques: 'obliques', 'hip flexors': 'hip_flexors',
  'cardiovascular system': 'cardio', 'rotator cuff': 'shoulders', 'rear deltoids': 'shoulders',
  deltoids: 'shoulders', 'inner thighs': 'adductors', groin: 'adductors', 'upper chest': 'chest',
  'lower abs': 'abs', core: 'abs', back: 'upper_back', quadriceps_: 'quads', wrists: 'forearms',
  'wrist flexors': 'forearms', 'wrist extensors': 'forearms', grip: 'forearms', shins: 'calves',
  ankles: 'calves', 'ankle stabilizers': 'calves', feet: 'calves', soleus: 'calves', trapezius: 'traps',
  rhomboids: 'upper_back', 'brachialis': 'biceps', sternocleidomastoid: 'neck', 'latissimus dorsi': 'lats',
  'lower legs': 'calves', 'upper arms': 'biceps',
};
const muscle = (m) => MUSCLE[String(m).toLowerCase()] ?? null;
const uniq = (list) => [...new Set(list.filter(Boolean))];

// Como se registra: tempo (prancha, alongamento), cardio, ou repetições
function kindOf(e) {
  const n = String(e.name).toLowerCase();
  if (e.body_part === 'cardio' || e.category === 'cardio') return 'cardio';
  if (e.category === 'stretching' || /\b(plank|hold|isometric|wall sit|stretch|hang)\b/.test(n)) return 'time';
  return 'reps';
}

const mit = await load('mit');
const free = await load('free');

const byKey = new Map();
const out = [];
for (const e of mit) {
  const rec = {
    id: `mit-${e.id}`,
    name: { en: e.name.charAt(0).toUpperCase() + e.name.slice(1) },
    body_part: BODY_PART[e.body_part] ?? 'other',
    target: muscle(e.target),
    secondary: uniq((e.secondary_muscles ?? []).map(muscle)).filter((m) => m !== muscle(e.target)),
    equipment: EQUIPMENT[e.equipment] ?? 'other',
    kind: kindOf({ ...e, category: e.body_part === 'cardio' ? 'cardio' : '' }),
    instructions: { en: e.instruction_steps?.en ?? [], es: e.instruction_steps?.es ?? [] },
    sources: ['mit'],
  };
  out.push(rec);
  byKey.set(`${nameKey(e.name)}|${rec.equipment}`, rec);
}

let merged = 0;
for (const e of free) {
  const equipment = EQUIPMENT[e.equipment ?? 'other'] ?? 'other';
  const extra = {
    level: e.level ?? null,
    mechanic: e.mechanic ?? null,
    force: e.force ?? null,
  };
  const found = byKey.get(`${nameKey(e.name)}|${equipment}`);
  if (found) {
    Object.assign(found, extra);
    found.secondary = uniq([...found.secondary, ...(e.secondaryMuscles ?? []).map(muscle)]).filter(
      (m) => m !== found.target,
    );
    found.sources.push('free');
    merged++;
    continue;
  }
  const primary = (e.primaryMuscles ?? []).map(muscle).filter(Boolean);
  const target = primary[0] ?? null;
  out.push({
    id: `free-${e.id}`,
    name: { en: e.name },
    body_part: bodyPartFor(target),
    target,
    secondary: uniq([...primary.slice(1), ...(e.secondaryMuscles ?? []).map(muscle)]).filter(
      (m) => m !== target,
    ),
    equipment,
    kind: kindOf({ name: e.name, category: e.category }),
    // Sem instruções: as da free-exercise-db não entram (origem duvidosa); a tradução escreve
    instructions: { en: [] },
    ...extra,
    sources: ['free'],
  });
}

function bodyPartFor(m) {
  if (['biceps', 'triceps', 'forearms'].includes(m)) return 'arms';
  if (['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors', 'hip_flexors'].includes(m)) return 'legs';
  if (['lats', 'upper_back', 'lower_back', 'traps'].includes(m)) return 'back';
  if (['abs', 'obliques', 'serratus'].includes(m)) return 'core';
  if (m === 'chest' || m === 'shoulders' || m === 'neck' || m === 'cardio') return m;
  return 'other';
}

out.sort((a, b) => a.name.en.localeCompare(b.name.en));
writeFileSync(path.join(root, 'data/exercicios/base.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`base.json: ${out.length} exercícios (${mit.length} MIT, ${free.length} free-exercise-db, ${merged} juntos)`);
