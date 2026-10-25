// Peças comuns aos scripts da base de exercícios (montar-base.mjs e fotos.mjs): o vocabulário de
// equipamento e a chave de nome que juntam o mesmo exercício nas duas bases.

// Vocabulário fixo do app (lib/gym/exercise-filter.ts usa os mesmos ids)
export const EQUIPMENT = {
  'body weight': 'bodyweight', 'body only': 'bodyweight', assisted: 'machine', weighted: 'bodyweight',
  dumbbell: 'dumbbell', barbell: 'barbell', 'olympic barbell': 'barbell', 'ez barbell': 'ez_bar',
  'e-z curl bar': 'ez_bar', 'trap bar': 'barbell', cable: 'cable', 'leverage machine': 'machine',
  machine: 'machine', 'smith machine': 'smith', 'sled machine': 'machine', kettlebell: 'kettlebell',
  kettlebells: 'kettlebell', band: 'band', bands: 'band', 'resistance band': 'band',
  'stability ball': 'ball', 'exercise ball': 'ball', 'bosu ball': 'ball', 'medicine ball': 'medicine_ball',
  roller: 'foam_roller', 'foam roll': 'foam_roller', 'wheel roller': 'other', rope: 'other',
  hammer: 'other', tire: 'other', other: 'other', 'upper body ergometer': 'cardio_machine',
  'skierg machine': 'cardio_machine', 'stationary bike': 'cardio_machine',
  'elliptical machine': 'cardio_machine', 'stepmill machine': 'cardio_machine',
};

// Chave para juntar: minúsculas, sem pontuação, sem palavras vazias, tokens em ordem
const STOP = new Set(['the', 'a', 'with', 'on', 'of', 'and', 'to', 'in', 'v', 'version']);
export const nameKey = (name) =>
  String(name)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
    .sort()
    .join(' ');
