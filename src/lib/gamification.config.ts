// Valores da gamificação. Quem concede XP, dano e ouro é o banco: o mesmo JSON
// está em public.xp_rules() (a versão mais nova, em supabase/migrations/20261017000000_rpg.sql) e o teste
// gamification.test.ts falha se os dois divergirem. Mudou aqui? Mude lá numa migração nova.
export const gamificationConfig = {
  xp: {
    /** Tarefa comum (lista, Caixa de entrada) */
    task: 10,
    /** Multiplicador por prioridade (0 a 3 = sem, !, !!, !!!). Vale também para o dano */
    priorityMultiplier: [1, 1, 1.25, 1.5],
    /** Hábito ou tarefa recorrente */
    habit: 8,
    /** +1 XP por dia da sequência global, até o teto */
    streakBonusPerDay: 1,
    streakBonusMax: 20,
    /** Item de página de cards ou subtarefa */
    checklistItem: 5,
    /** Página de cards inteira marcada no ciclo */
    pageBonus: 25,
    pageBonusMinItems: 3,
    /** Cada "+" num hábito bom/ruim */
    habitPlus: 3,
  },
  antiFarm: {
    /** Concluída em menos disso depois de criada: 0 XP (fora de cards e hábitos), mas o golpe vale */
    tooFastSeconds: 30,
    /** Concluídas em menos disso depois de criadas somam no máximo dailyQuickCap XP por dia */
    quickSeconds: 300,
    dailyQuickCap: 50,
    /** ... e no máximo isto de dano por dia */
    dailyQuickDamageCap: 20,
    /** "+" de um hábito que valem XP, dano e ouro por dia */
    habitPlusDailyCap: 10,
  },
  level: {
    /** XP para passar do nível n para o n+1 = round(base * n ^ exponent) */
    base: 100,
    exponent: 1.4,
  },
  boss: {
    /** HP do boss de nível n = round(hpBase * hpGrowth ^ (n - 1)); o do clã, vezes os membros ativos */
    hpBase: 120,
    hpGrowth: 1.2,
    /** O solo nunca tem menos que recentFactor × o dano médio semanal das últimas semanas */
    recentWeeks: 4,
    recentFactor: 0.8,
    rewardXp: 50,
    /** Ouro da vitória = rewardGold + rewardGoldPerLevel × (nível − 1) */
    rewardGold: 20,
    rewardGoldPerLevel: 10,
    /** Ouro a mais quando não há item novo para cair */
    noDropGold: 25,
  },
  damage: {
    /** Dano base por tipo (antes dos atributos) */
    task: 4,
    habit: 3,
    checklistItem: 2,
    pageBonus: 8,
    habitPlus: 2,
    /** Quanto um "−" num hábito ruim cura o boss (antes da Constituição) */
    habitMinusHeal: 3,
    /** +5% de dano por ponto de Força (tarefas) ou Inteligência (rotinas) */
    perPoint: 0.05,
    /** +2% de chance de crítico por ponto de Agilidade, até critMax */
    critPerAgi: 0.02,
    critMax: 0.6,
    critMultiplier: 2,
  },
  gold: {
    task: 2,
    habit: 1,
    checklistItem: 1,
    pageBonus: 5,
    habitPlus: 1,
    /** +3% de ouro por ponto de Constituição */
    perCon: 0.03,
  },
  attributes: {
    /** Todo atributo começa aqui, mais o bônus da classe */
    base: 1,
    /** Pontos para distribuir a cada nível acima do 1 */
    pointsPerLevel: 1,
    /** Cada ponto de Constituição tira 8% da cura dos hábitos ruins, até 80% */
    healReducePerCon: 0.08,
    healReduceMax: 0.8,
  },
  /** Bônus de atributo de cada classe */
  classes: {
    lutador: { str: 3, agi: 0, int: 0, con: 1 },
    mago: { str: 0, agi: 1, int: 3, con: 0 },
    arqueiro: { str: 1, agi: 3, int: 0, con: 0 },
    paladino: { str: 0, agi: 0, int: 1, con: 3 },
    ladino: { str: 1, agi: 2, int: 0, con: 1 },
  },
  skills: {
    /** Lutador (passiva): o primeiro golpe do dia */
    firstStrikeMultiplier: 2,
    /** Mago (passiva): +2% de dano por dia de sequência, até +30% */
    streakFocusPerDay: 0.02,
    streakFocusMax: 0.3,
    /** Arqueiro (passiva): crítico mais forte */
    archerCritMultiplier: 2.5,
    /** Paladino (passiva): hábitos ruins curam metade */
    paladinHealReduce: 0.5,
    /** Ladino (passiva): +50% de ouro */
    rogueGoldBonus: 0.5,
    /** Ativas (uma vez por dia, valem o dia todo) */
    furyBonus: 0.5,
    stormBonus: 0.5,
    aimCritBonus: 0.25,
    blessingBonus: 0.3,
    ambushMultiplier: 2,
  },
  habits: {
    /** Meta máxima de um hábito contador */
    maxTarget: 100,
  },
} as const;

export type GamificationConfig = typeof gamificationConfig;
