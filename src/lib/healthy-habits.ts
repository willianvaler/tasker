// Hábitos prontos da Vida saudável (BE3, D275). O nome de cada um fica no i18n
// (`healthy.items.<key>`); aqui só o tipo: caixinha por dia ou contador com a meta do dia.

export type HealthyHabit = {
  key: string;
  icon: string;
  kind: 'check' | 'counter';
  target?: number;
};

export const HEALTHY_HABITS: HealthyHabit[] = [
  { key: 'water', icon: '💧', kind: 'counter', target: 8 },
  { key: 'sleep', icon: '😴', kind: 'check' },
  { key: 'walk', icon: '🚶', kind: 'check' },
  { key: 'steps', icon: '👟', kind: 'check' },
  { key: 'fruit', icon: '🍎', kind: 'counter', target: 2 },
  { key: 'veggies', icon: '🥦', kind: 'check' },
  { key: 'noSugar', icon: '🚫', kind: 'check' },
  { key: 'stretch', icon: '🤸', kind: 'check' },
  { key: 'meditate', icon: '🧘', kind: 'check' },
  { key: 'screens', icon: '📵', kind: 'check' },
  { key: 'sun', icon: '☀️', kind: 'check' },
];

/** Para saber se o hábito já existe: sem caixa, sem acento, sem espaço sobrando. */
export function habitTitleKey(title: string) {
  return title.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
