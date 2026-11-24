// Hábitos prontos da Vida saudável (BE3, D275). O nome de cada um fica no i18n
// (`healthy.items.<key>`) e o ícone, no componente; aqui só o tipo: caixinha por dia ou contador com a meta do dia.

export type HealthyHabit = {
  key: string;
  kind: 'check' | 'counter';
  target?: number;
};

export const HEALTHY_HABITS: HealthyHabit[] = [
  { key: 'water', kind: 'counter', target: 8 },
  { key: 'sleep', kind: 'check' },
  { key: 'walk', kind: 'check' },
  { key: 'steps', kind: 'check' },
  { key: 'fruit', kind: 'counter', target: 2 },
  { key: 'veggies', kind: 'check' },
  { key: 'noSugar', kind: 'check' },
  { key: 'stretch', kind: 'check' },
  { key: 'meditate', kind: 'check' },
  { key: 'screens', kind: 'check' },
  { key: 'sun', kind: 'check' },
];

/** Para saber se o hábito já existe: sem caixa, sem acento, sem espaço sobrando. */
export function habitTitleKey(title: string) {
  return title.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
