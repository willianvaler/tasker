// Tipos comuns da academia (ESCOPO_V6, docs/TAREFAS_V6.md). Só tipos: as funções puras de
// src/lib/gym/ (1RM, recordes, progressão, anilhas, ranking...) partem deles, para poderem ser
// escritas em paralelo e casarem depois com o banco.

export type WeightUnit = 'kg' | 'lb';

/** Parte do corpo (como nas bases de exercícios). */
export type BodyPart =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'upper arms'
  | 'lower arms'
  | 'upper legs'
  | 'lower legs'
  | 'waist'
  | 'cardio'
  | 'neck';

/** Músculo (nomes da free-exercise-db, em inglês, como chave). */
export type Muscle =
  | 'abdominals'
  | 'abductors'
  | 'adductors'
  | 'biceps'
  | 'calves'
  | 'chest'
  | 'forearms'
  | 'glutes'
  | 'hamstrings'
  | 'lats'
  | 'lower back'
  | 'middle back'
  | 'neck'
  | 'quadriceps'
  | 'shoulders'
  | 'traps'
  | 'triceps';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'kettlebells'
  | 'bands'
  | 'body only'
  | 'e-z curl bar'
  | 'exercise ball'
  | 'foam roll'
  | 'medicine ball'
  | 'other';

export type Exercise = {
  id: string;
  /** Nome por idioma (pt-BR, en, es); falta = usa o en */
  name: { 'pt-BR'?: string; en: string; es?: string };
  /** Outros nomes que a pessoa pode digitar ("supino", "bench press") */
  aliases: string[];
  bodyPart: BodyPart;
  primary: Muscle[];
  secondary: Muscle[];
  equipment: Equipment;
  /** Exercício criado pela pessoa (não vem do catálogo) */
  custom?: boolean;
};

/** Como o item é registrado: carga × reps, tempo segurado, ou cardio. */
export type LogMode = 'reps' | 'time' | 'cardio';

/** Uma série como aconteceu. Campos ausentes = não se aplicam ao modo. */
export type LoggedSet = {
  /** Previsto quando a série foi feita (para julgar acerto ou falha) */
  target?: { weight?: number; reps?: number; sec?: number };
  done: boolean;
  weight?: number;
  reps?: number;
  sec?: number;
  /** Cardio */
  distance?: number;
  speed?: number;
  warmup?: boolean;
  /** Esforço, numa das duas escalas (nunca as duas) */
  rir?: number;
  rpe?: number;
};

/** Uma sessão de um exercício (um dia), com as séries na ordem. */
export type ExerciseSession = {
  /** 'YYYY-MM-DD' no fuso da pessoa */
  date: string;
  exerciseId: string;
  mode: LogMode;
  sets: LoggedSet[];
  /** Minutos do treino inteiro naquele dia (para o mapa de calor) */
  minutes?: number;
};

export type ProgressionPolicy = 'off' | 'linear' | 'double' | 'greyskull' | 'time';

export type ProgressionConfig = {
  policy: ProgressionPolicy;
  /** Degrau de carga (kg ou lb, na unidade da pessoa) */
  increment: number;
  /** Progressão dupla: faixa de reps */
  repRange?: { min: number; max: number };
  /** Modo tempo: segundos a somar */
  secIncrement?: number;
  /** Exercício com o peso do corpo (progride em reps, não em carga) */
  bodyweight?: boolean;
};

/** Próxima prescrição e o porquê (chave de i18n + variáveis). */
export type Prescription = {
  weight?: number;
  reps?: number;
  sec?: number;
  kind: 'first' | 'up' | 'hold' | 'deload' | 'off';
  why: { key: string; vars?: Record<string, string | number> };
};
