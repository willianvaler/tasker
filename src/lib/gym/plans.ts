import { DEFAULT_REST_SECONDS, type RepeatPlan } from '../repeat';
import type { TaskMeta } from '../parser/quick';
import type { ProgressionRule } from './progression';
import type { Weekday } from './week-plan';

// Planos prontos (AC12.1, V6 §10): cada plano vira uma pasta dentro da Academia com um treino
// (lista de cards, reinício semanal) por dia de treino, os dias da semana já marcados (AC9.5), a
// regra de progressão (AC6) e os exercícios ligados ao catálogo (AC3.6), com séries, repetições ou
// tempo e descanso. Nomes e descrições ficam no i18n (`plans.<id>`); aqui só a estrutura. Os ids
// são do catálogo (data/exercicios/base.json), de preferência os que vêm da free-exercise-db, que
// têm foto (AC3.10).

export type PlanItem = {
  /** Id do catálogo */
  exercise: string;
  sets: number;
  /** Repetições por série; sem isto, `sec` (exercício por tempo) */
  reps?: number;
  sec?: number;
  /** Descanso entre séries (s) */
  rest: number;
};

export type PlanWorkout = { key: string; days: Weekday[]; items: PlanItem[] };

export type GymPlan = {
  id: string;
  icon: string;
  place: 'gym' | 'home';
  level: 'beginner' | 'intermediate';
  progression: ProgressionRule;
  workouts: PlanWorkout[];
};

const r = (exercise: string, sets: number, reps: number, rest = 90): PlanItem => ({
  exercise,
  sets,
  reps,
  rest,
});
const s = (exercise: string, sets: number, sec: number, rest = 45): PlanItem => ({
  exercise,
  sets,
  sec,
  rest,
});

// Exercícios usados (nomes do catálogo em pt-BR ao lado)
const X = {
  squat: 'free-Barbell_Squat', // Agachamento com barra
  goblet: 'free-Goblet_Squat', // Agachamento goblet
  legPress: 'free-Leg_Press',
  rdl: 'free-Romanian_Deadlift', // Levantamento terra romeno
  deadlift: 'mit-0032', // Levantamento terra com barra
  legCurl: 'free-Lying_Leg_Curls', // Mesa flexora
  legExt: 'free-Leg_Extensions', // Cadeira extensora
  calf: 'free-Standing_Calf_Raises', // Panturrilha em pé
  seatedCalf: 'free-Seated_Calf_Raise',
  hipThrust: 'free-Barbell_Hip_Thrust',
  lunge: 'free-Bodyweight_Walking_Lunge', // Afundo andando
  splitSquat: 'free-Split_Squats',
  bench: 'free-Barbell_Bench_Press_-_Medium_Grip', // Supino reto com barra
  inclineBench: 'free-Barbell_Incline_Bench_Press_-_Medium_Grip',
  dbBench: 'mit-0289', // Supino reto com halteres
  inclineDb: 'free-Incline_Dumbbell_Press', // Supino inclinado com halteres
  fly: 'free-Dumbbell_Flyes', // Crucifixo com halteres
  crossover: 'free-Cable_Crossover',
  ohp: 'free-Standing_Military_Press', // Desenvolvimento militar em pé
  dbPress: 'free-Dumbbell_Shoulder_Press', // Desenvolvimento com halteres
  lateral: 'free-Side_Lateral_Raise', // Elevação lateral
  facePull: 'free-Face_Pull',
  row: 'mit-0027', // Remada curvada com barra
  dbRow: 'free-One-Arm_Dumbbell_Row', // Remada unilateral com halter
  cableRow: 'mit-0180', // Remada sentada baixa
  pulldown: 'free-Wide-Grip_Lat_Pulldown', // Puxada aberta
  pullup: 'free-Pullups', // Barra fixa
  chinup: 'mit-1326', // Barra fixa supinada
  curl: 'mit-0031', // Rosca direta com barra
  hammer: 'free-Hammer_Curls', // Rosca martelo
  pushdown: 'free-Triceps_Pushdown', // Tríceps pulley
  skull: 'free-EZ-Bar_Skullcrusher', // Tríceps testa
  plank: 'free-Plank', // Prancha
  crunch: 'free-Crunches', // Abdominal
  legRaise: 'mit-0472', // Elevação de pernas pendurado
  // Em casa, sem equipamento
  pushup: 'free-Pushups', // Flexão
  inclinePushup: 'free-Incline_Push-Up_Medium', // Flexão inclinada
  closePushup: 'free-Push-Ups_-_Close_Triceps_Position', // Flexão fechada
  airSquat: 'free-Bodyweight_Squat', // Agachamento livre
  jumpSquat: 'free-Freehand_Jump_Squat', // Agachamento com salto
  bridge: 'free-Butt_Lift_Bridge', // Ponte de glúteo
  oneLegBridge: 'free-Single_Leg_Glute_Bridge',
  benchDip: 'free-Bench_Dips', // Mergulho no banco (numa cadeira)
  superman: 'free-Superman',
  climber: 'free-Mountain_Climbers', // Escalador
  sitUp: 'free-Sit-Up', // Abdominal completo
  starJump: 'free-Star_Jump', // Salto estrela
} as const;

// Dias: 1 = segunda ... 6 = sábado
export const GYM_PLANS: GymPlan[] = [
  {
    id: 'fullbody3',
    icon: 'lucide:dumbbell',
    place: 'gym',
    level: 'beginner',
    progression: 'double',
    workouts: [
      {
        key: 'a',
        days: [1, 5],
        items: [
          r(X.goblet, 3, 10),
          r(X.dbBench, 3, 10),
          r(X.pulldown, 3, 10),
          r(X.rdl, 3, 10),
          r(X.lateral, 2, 12, 60),
          s(X.plank, 3, 30),
        ],
      },
      {
        key: 'b',
        days: [3],
        items: [
          r(X.legPress, 3, 12),
          r(X.dbPress, 3, 10),
          r(X.cableRow, 3, 10),
          r(X.legCurl, 3, 12),
          r(X.hammer, 2, 12, 60),
          r(X.crunch, 3, 15, 45),
        ],
      },
    ],
  },
  {
    id: 'abc',
    icon: 'lucide:dumbbell',
    place: 'gym',
    level: 'beginner',
    progression: 'double',
    workouts: [
      {
        key: 'a',
        days: [1],
        items: [
          r(X.bench, 4, 10),
          r(X.inclineDb, 3, 10),
          r(X.fly, 3, 12, 60),
          r(X.dbPress, 3, 10),
          r(X.lateral, 3, 12, 60),
          r(X.pushdown, 3, 12, 60),
        ],
      },
      {
        key: 'b',
        days: [3],
        items: [
          r(X.pulldown, 4, 10),
          r(X.row, 3, 10),
          r(X.dbRow, 3, 10),
          r(X.facePull, 3, 15, 60),
          r(X.curl, 3, 10, 60),
          r(X.hammer, 3, 12, 60),
        ],
      },
      {
        key: 'c',
        days: [5],
        items: [
          r(X.squat, 4, 10, 120),
          r(X.legPress, 3, 12),
          r(X.rdl, 3, 10),
          r(X.legExt, 3, 12, 60),
          r(X.legCurl, 3, 12, 60),
          r(X.calf, 4, 15, 45),
        ],
      },
    ],
  },
  {
    id: 'abcd',
    icon: 'lucide:dumbbell',
    place: 'gym',
    level: 'intermediate',
    progression: 'double',
    workouts: [
      {
        key: 'a',
        days: [1],
        items: [
          r(X.bench, 4, 8, 120),
          r(X.inclineDb, 3, 10),
          r(X.crossover, 3, 12, 60),
          r(X.pushdown, 3, 12, 60),
          r(X.skull, 3, 10, 60),
        ],
      },
      {
        key: 'b',
        days: [2],
        items: [
          r(X.pullup, 4, 8, 120),
          r(X.row, 4, 8, 120),
          r(X.cableRow, 3, 10),
          r(X.curl, 3, 10, 60),
          r(X.hammer, 3, 12, 60),
        ],
      },
      {
        key: 'c',
        days: [4],
        items: [
          r(X.squat, 4, 8, 150),
          r(X.legPress, 3, 12),
          r(X.legExt, 3, 12, 60),
          r(X.legCurl, 3, 12, 60),
          r(X.hipThrust, 3, 10),
          r(X.calf, 4, 15, 45),
        ],
      },
      {
        key: 'd',
        days: [5],
        items: [
          r(X.ohp, 4, 8, 120),
          r(X.lateral, 4, 12, 60),
          r(X.facePull, 3, 15, 60),
          r(X.legRaise, 3, 12, 60),
          s(X.plank, 3, 45),
        ],
      },
    ],
  },
  {
    id: 'upperlower',
    icon: 'lucide:dumbbell',
    place: 'gym',
    level: 'intermediate',
    progression: 'double',
    workouts: [
      {
        key: 'upperA',
        days: [1],
        items: [
          r(X.bench, 4, 8, 120),
          r(X.row, 4, 8, 120),
          r(X.dbPress, 3, 10),
          r(X.pulldown, 3, 10),
          r(X.curl, 2, 12, 60),
          r(X.pushdown, 2, 12, 60),
        ],
      },
      {
        key: 'lowerA',
        days: [2],
        items: [
          r(X.squat, 4, 8, 150),
          r(X.rdl, 3, 10, 120),
          r(X.legPress, 3, 12),
          r(X.legCurl, 3, 12, 60),
          r(X.calf, 4, 15, 45),
        ],
      },
      {
        key: 'upperB',
        days: [4],
        items: [
          r(X.ohp, 4, 8, 120),
          r(X.pullup, 4, 8, 120),
          r(X.inclineDb, 3, 10),
          r(X.cableRow, 3, 10),
          r(X.lateral, 3, 12, 60),
          r(X.hammer, 2, 12, 60),
        ],
      },
      {
        key: 'lowerB',
        days: [5],
        items: [
          r(X.deadlift, 3, 5, 180),
          r(X.splitSquat, 3, 10),
          r(X.hipThrust, 3, 10),
          r(X.legExt, 3, 12, 60),
          r(X.seatedCalf, 4, 15, 45),
          s(X.plank, 3, 45),
        ],
      },
    ],
  },
  {
    id: 'ppl',
    icon: 'lucide:dumbbell',
    place: 'gym',
    level: 'intermediate',
    progression: 'double',
    workouts: [
      {
        key: 'push',
        days: [1, 4],
        items: [
          r(X.bench, 4, 8, 120),
          r(X.ohp, 3, 8, 120),
          r(X.inclineDb, 3, 10),
          r(X.lateral, 3, 12, 60),
          r(X.pushdown, 3, 12, 60),
        ],
      },
      {
        key: 'pull',
        days: [2, 5],
        items: [
          r(X.deadlift, 3, 5, 180),
          r(X.pulldown, 3, 10),
          r(X.cableRow, 3, 10),
          r(X.facePull, 3, 15, 60),
          r(X.curl, 3, 10, 60),
        ],
      },
      {
        key: 'legs',
        days: [3, 6],
        items: [
          r(X.squat, 4, 8, 150),
          r(X.rdl, 3, 10, 120),
          r(X.legPress, 3, 12),
          r(X.legCurl, 3, 12, 60),
          r(X.calf, 4, 15, 45),
        ],
      },
    ],
  },
  {
    // 5×5 de barra (estilo StrongLifts): A e B alternados. Com o plano por dia da semana, A fica
    // na segunda e na sexta e B na quarta (a alternância semana a semana fica com a pessoa).
    id: 'fivebyfive',
    icon: 'lucide:dumbbell',
    place: 'gym',
    level: 'beginner',
    progression: 'linear',
    workouts: [
      {
        key: 'a',
        days: [1, 5],
        items: [r(X.squat, 5, 5, 180), r(X.bench, 5, 5, 180), r(X.row, 5, 5, 180)],
      },
      {
        key: 'b',
        days: [3],
        items: [r(X.squat, 5, 5, 180), r(X.ohp, 5, 5, 180), r(X.deadlift, 1, 5, 180)],
      },
    ],
  },
  {
    // Greyskull LP: 3×5 com a última série até a falha (a regra greyskull já conta assim)
    id: 'greyskull',
    icon: 'lucide:dumbbell',
    place: 'gym',
    level: 'beginner',
    progression: 'greyskull',
    workouts: [
      {
        key: 'a',
        days: [1, 5],
        items: [r(X.ohp, 3, 5, 150), r(X.chinup, 3, 8, 120), r(X.squat, 3, 5, 150)],
      },
      {
        key: 'b',
        days: [3],
        items: [r(X.bench, 3, 5, 150), r(X.row, 3, 5, 150), r(X.deadlift, 1, 5, 180)],
      },
    ],
  },
  {
    id: 'home',
    icon: 'lucide:house',
    place: 'home',
    level: 'beginner',
    progression: 'double',
    workouts: [
      {
        key: 'a',
        days: [1, 5],
        items: [
          r(X.pushup, 3, 10, 60),
          r(X.airSquat, 3, 15, 60),
          r(X.lunge, 3, 10, 60),
          r(X.benchDip, 3, 10, 60),
          r(X.bridge, 3, 15, 45),
          s(X.plank, 3, 30),
        ],
      },
      {
        key: 'b',
        days: [3],
        items: [
          r(X.inclinePushup, 3, 12, 60),
          r(X.jumpSquat, 3, 10, 60),
          r(X.oneLegBridge, 3, 10, 45),
          r(X.closePushup, 3, 8, 60),
          r(X.climber, 3, 20, 45),
          s(X.superman, 3, 30),
          r(X.sitUp, 3, 15, 45),
          r(X.starJump, 3, 15, 45),
        ],
      },
    ],
  },
];

export const PLAN_EXERCISES: readonly string[] = Object.values(X);

/** Um item do plano como ele vai para a lista: plano de séries e o detalhe dos cards. */
export function planItemToTask(item: PlanItem): {
  repeatPlan: RepeatPlan;
  meta: TaskMeta;
  timed: boolean;
} {
  if (item.sec) {
    return {
      repeatPlan: {
        mode: 'timed',
        total: item.sets,
        duration_seconds: item.sec,
        rest_seconds: item.rest || DEFAULT_REST_SECONDS,
      },
      meta: { sets: item.sets },
      timed: true,
    };
  }
  return {
    repeatPlan: { mode: 'sets', total: item.sets, rest_seconds: item.rest || DEFAULT_REST_SECONDS },
    meta: { sets: item.sets, reps: item.reps },
    timed: false,
  };
}

/** Quantos treinos por semana o plano tem (dias distintos). */
export function planDaysPerWeek(plan: GymPlan) {
  return new Set(plan.workouts.flatMap((w) => w.days)).size;
}
