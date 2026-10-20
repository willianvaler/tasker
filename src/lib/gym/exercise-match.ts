// Achar o exercício a partir do que foi digitado (AC3.4, D235): "Supino reto 4x10 40kg" → Supino
// reto com barra. Compara palavras sem acento nos três idiomas, com sinônimos de academia.

export type ExerciseLike = {
  id: string;
  name_en: string;
  name_pt?: string | null;
  name_es?: string | null;
  equipment?: string | null;
};

/** Minúsculas, sem acento, sem pontuação; tira séries, reps e carga ("4x10", "40kg", "3"). */
export function normalizeName(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\b\d+\s*x\s*\d+\b/g, ' ')
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:kg|lb|lbs|s|seg|min)?\b/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'com',
  'na',
  'no',
  'em',
  'a',
  'o',
  'e',
  'para',
  'the',
  'with',
  'on',
  'of',
  'and',
  'en',
  'la',
  'el',
  'con',
  'y',
  'al',
  'del',
  'los',
  'las',
]);

// Palavra de academia → palavra em inglês do catálogo (o nome em inglês sempre existe)
const SYNONYMS: Record<string, string[]> = {
  supino: ['bench', 'press'],
  agachamento: ['squat'],
  sentadilla: ['squat'],
  terra: ['deadlift'],
  rosca: ['curl'],
  curl: ['curl'],
  puxada: ['pulldown'],
  remada: ['row'],
  remo: ['row'],
  desenvolvimento: ['shoulder', 'press'],
  elevacao: ['raise'],
  elevacion: ['raise'],
  lateral: ['lateral'],
  frontal: ['front'],
  triceps: ['triceps'],
  testa: ['skull', 'crusher'],
  extensora: ['leg', 'extension'],
  flexora: ['leg', 'curl'],
  panturrilha: ['calf', 'raise'],
  gemelos: ['calf', 'raise'],
  abdominal: ['crunch'],
  prancha: ['plank'],
  plancha: ['plank'],
  barra: ['barbell'],
  fixa: ['pull', 'up'],
  dominada: ['pull', 'up'],
  flexao: ['push', 'up'],
  flexiones: ['push', 'up'],
  afundo: ['lunge'],
  zancada: ['lunge'],
  stiff: ['stiff', 'leg', 'deadlift'],
  crucifixo: ['fly'],
  aperturas: ['fly'],
  halter: ['dumbbell'],
  halteres: ['dumbbell'],
  mancuerna: ['dumbbell'],
  mancuernas: ['dumbbell'],
  polia: ['cable'],
  cabo: ['cable'],
  maquina: ['machine'],
  inclinado: ['incline'],
  declinado: ['decline'],
  reto: ['bench'],
  pernas: ['leg'],
  perna: ['leg'],
  ombro: ['shoulder'],
  ombros: ['shoulder'],
  peito: ['chest'],
  costas: ['back'],
  esteira: ['treadmill'],
  bicicleta: ['bike'],
  corrida: ['run'],
  pular: ['jump'],
  corda: ['rope'],
};

// Plural simples ("halteres" → "haltere", "rows" → "row"), sem estragar "press" nem "cross"
const singularOf = (w: string) =>
  w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;

/** Palavras que contam: sem as vazias, com o plural simples tirado e os sinônimos somados. */
export function nameTokens(text: string) {
  const words = normalizeName(text)
    .split(' ')
    .filter((w) => w && !STOP.has(w));
  const out = new Set<string>();
  for (const w of words) {
    const singular = singularOf(w);
    out.add(singular);
    for (const s of SYNONYMS[w] ?? SYNONYMS[singular] ?? []) out.add(singularOf(s));
  }
  return out;
}

/** Quanto o texto parece o exercício (0 a 1), no melhor dos três nomes. */
export function matchScore(text: string, exercise: ExerciseLike) {
  const query = nameTokens(text);
  if (query.size === 0) return 0;
  let best = 0;
  for (const name of [exercise.name_pt, exercise.name_es, exercise.name_en]) {
    if (!name) continue;
    if (normalizeName(name) === normalizeName(text)) return 1;
    const candidate = nameTokens(name);
    let common = 0;
    for (const t of query) if (candidate.has(t)) common++;
    // Cobertura do que foi digitado pesa mais que a do nome (nome do catálogo é mais longo)
    const score = (common / query.size) * 0.7 + (common / Math.max(candidate.size, 1)) * 0.3;
    best = Math.max(best, score);
  }
  return best;
}

/** Os melhores candidatos para o texto, do mais parecido para o menos (empate: nome mais curto). */
export function suggestExercises<T extends ExerciseLike>(
  text: string,
  list: T[],
  limit = 5,
  min = 0.5,
) {
  return list
    .map((e) => ({ exercise: e, score: matchScore(text, e) }))
    .filter((s) => s.score >= min)
    .sort((a, b) => b.score - a.score || a.exercise.name_en.length - b.exercise.name_en.length)
    .slice(0, limit);
}
