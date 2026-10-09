// Valores da gamificação (ESCOPO 4.6). Quem concede o XP é o banco: o mesmo JSON está em
// public.xp_rules() (supabase/migrations/20261011000000_fase3_gamificacao.sql) e o teste
// gamification.test.ts falha se os dois divergirem. Mudou aqui? Mude lá numa migração nova.
export const gamificationConfig = {
  xp: {
    /** Tarefa comum (lista, Caixa de entrada) */
    task: 10,
    /** Multiplicador por prioridade (0 a 3 = sem, !, !!, !!!) */
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
  },
  antiFarm: {
    /** Concluída em menos disso depois de criada: 0 XP (fora de cards e hábitos) */
    tooFastSeconds: 30,
    /** Concluídas em menos disso depois de criadas somam no máximo dailyQuickCap por dia */
    quickSeconds: 300,
    dailyQuickCap: 50,
  },
  level: {
    /** XP para passar do nível n para o n+1 = round(base * n ^ exponent) */
    base: 100,
    exponent: 1.4,
  },
  boss: {
    /** HP = max(minHp + hpPerLevel * nível, média semanal de XP das últimas semanas * recentFactor) */
    minHp: 100,
    hpPerLevel: 15,
    recentWeeks: 4,
    recentFactor: 0.8,
    rewardXp: 50,
  },
} as const;

export type GamificationConfig = typeof gamificationConfig;
