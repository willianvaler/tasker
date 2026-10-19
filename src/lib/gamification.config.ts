// Valores da gamificação. Quem concede XP, dano e ouro é o banco: o mesmo JSON
// está em public.xp_rules() (a versão mais nova, em supabase/migrations/20261139000000_calibragem_dano.sql) e o teste
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
    /** Foco de pomodoro concluído (K4) */
    pomodoro: 5,
  },
  antiFarm: {
    /** Concluída em menos disso depois de criada: 0 XP (fora de cards e hábitos), mas o golpe vale */
    tooFastSeconds: 30,
    /** Concluídas em menos disso depois de criadas somam no máximo dailyQuickCap XP por dia */
    quickSeconds: 300,
    dailyQuickCap: 50,
    /** ... e no máximo isto de dano por dia */
    dailyQuickDamageCap: 50,
    /** "+" de um hábito que valem XP, dano e ouro por dia */
    habitPlusDailyCap: 10,
    /** Pomodoros que valem XP por dia, e o foco mínimo para valer */
    pomodoroDailyCap: 4,
    pomodoroMinMinutes: 15,
  },
  level: {
    /** XP para passar do nível n para o n+1 = round(base * n ^ exponent) */
    base: 100,
    exponent: 1.4,
  },
  boss: {
    /** HP do boss de nível n = round(hpBase * hpGrowth ^ (n - 1)); o do clã, vezes os membros ativos */
    hpBase: 300,
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
  /** Boss diário (O1, V4 §1.1): nasce à meia-noite do fuso e vai até o fim do dia */
  dailyBoss: {
    /** HP do nível n = round(min(hpBase × hpGrowth^(n−1), hpBase × hpMaxFactor)) */
    hpBase: 60,
    hpGrowth: 1.05,
    hpMaxFactor: 3,
    /** Nunca menos que recentFactor × a média de dano dos dias ativos nos últimos recentDays */
    recentDays: 14,
    recentFactor: 0.7,
    /** Recompensa menor que a do semanal; o item é só uma chance */
    rewardXp: 15,
    rewardGold: 5,
    rewardGoldPerLevel: 1,
    noDropGold: 5,
    dropChance: 0.15,
  },
  damage: {
    /** Dano base por tipo (antes dos atributos). O2: 2,5× os de antes */
    task: 10,
    habit: 8,
    checklistItem: 5,
    pageBonus: 20,
    habitPlus: 5,
    /** Quanto um "−" num hábito ruim cura o boss (antes da Constituição) */
    habitMinusHeal: 8,
    /** +5% de dano por ponto de Força (tarefas) ou Inteligência (rotinas) */
    perPoint: 0.05,
    /** +2% de chance de crítico por ponto de Agilidade, até critMax */
    critPerAgi: 0.02,
    critMax: 0.6,
    critMultiplier: 2,
    /** Peso da tarefa (M3): +25% de golpe por ponto acima de 1 (peso 5 = 2×) */
    weightStep: 0.25,
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
  /** Modo jogo Completo (ESCOPO_V8, HB5 a HB10; regras do Habitica em docs/HABITICA.md) */
  game: {
    /** Vida: máximo, e o que a virada do dia tira por diária perdida (× prioridade × redução da CON) */
    maxHp: 50,
    dailyDamage: 2,
    /** Peso da prioridade da diária (0 a 3) no dano */
    priorityWeight: [1, 1, 1.5, 2],
    /** Cada ponto de CON tira 0,4% do dano, até sobrar 10% */
    conReducePer: 0.004,
    conReduceMin: 0.1,
    /** Mana: 30 + 2 por INT; +1 por tarefa ou "+" com XP; na virada, até max(10; 10% do máximo) */
    baseMp: 30,
    mpPerInt: 2,
    mpPerTask: 1,
    mpRegenMin: 10,
    mpRegenPct: 0.1,
    /** Morte: comprar uma vida (mantém tudo) ou recomeçar do nível 1 (D197) */
    revivePrice: 500,
    /** Poção de vida, antes de morrer */
    potionPrice: 25,
    potionHeal: 15,
    /** Dia perfeito: + ceil(nível / 2) em todos os atributos no dia seguinte */
    perfectDayDivisor: 2,
    /** Escudo (habilidade): a próxima virada tira só esta fração */
    shieldFactor: 0.5,
    /** Baú encantado (HB7) */
    armoirePrice: 100,
    /** Drops de mascote (HB8): chance por tarefa com XP, teto por dia */
    dropChance: 0.15,
    dropDailyCap: 5,
    /** Alimentar: comida favorita (a da cor da poção) +5, outra +2; com 50 vira montaria */
    feedFavorite: 5,
    feedOther: 2,
    feedToMount: 50,
    /** Missões (HB9): pergaminho na loja, duração, chance de pergaminho num drop */
    scrollPrice: 150,
    questDays: 14,
    scrollDropShare: 0.05,
    /** Equipamento de batalha (HB10): bônus no atributo do espaço, pela raridade */
    rarityBonus: { common: 0, rare: 1, epic: 2, legendary: 3 },
    slotAttribute: { head: 'con', hand: 'str', pet: 'agi', aura: 'int', title: 'none' },
    /** Mascotes (HB8): espécies (arte em assets/game), poções e a comida favorita de cada poção */
    pets: {
      species: ['lobo', 'raposa', 'coruja', 'cervo', 'urso', 'javali', 'grifo', 'dragao'],
      potions: ['comum', 'sombra', 'dourada', 'gelo'],
      foods: { comum: 'carne', sombra: 'cogumelo', dourada: 'mel', gelo: 'peixe' },
    },
    /** Missões (HB9): boss com capítulo (texto no i18n, arte em assets/game/bosses) */
    quests: [
      { key: 'dragao-do-prazo-perdido', name: 'Dragão do Prazo Perdido', hp: 400 },
      { key: 'bruxa-do-pantano', name: 'Bruxa do Pântano', hp: 300 },
      { key: 'cavaleiro-sem-fim', name: 'Cavaleiro Sem Fim', hp: 500 },
      { key: 'aranha-das-mensagens', name: 'Aranha das Mensagens', hp: 350 },
      { key: 'rei-esqueleto', name: 'Rei Esqueleto', hp: 600 },
      { key: 'golem-de-ferro', name: 'Golem de Ferro', hp: 450 },
    ],
    /** Avatar (HB10): variações de retrato por classe e cenários de fundo */
    portraits: ['f-clara', 'f-escura', 'm-clara', 'm-escura'],
    backgrounds: ['acampamento', 'taverna', 'floresta', 'castelo', 'montanha', 'masmorra'],
    /**
     * Habilidades de mana (HB6): 4 por classe, liberadas por nível. Efeitos: strike (dano nos bosses,
     * + FOR), heal (vida), healClan (vida de todos do clã), shield (próxima virada pela metade),
     * stealth (evita N diárias perdidas na próxima virada), gold (ouro na hora).
     */
    manaSkills: {
      lutador: [
        { key: 'golpe_brutal', level: 3, mana: 10, effect: 'strike', power: 8 },
        { key: 'pele_de_ferro', level: 5, mana: 20, effect: 'shield', power: 1 },
        { key: 'folego', level: 8, mana: 15, effect: 'heal', power: 15 },
        { key: 'investida', level: 11, mana: 30, effect: 'strike', power: 20 },
      ],
      mago: [
        { key: 'bola_de_fogo', level: 3, mana: 10, effect: 'strike', power: 9 },
        { key: 'escudo_arcano', level: 5, mana: 20, effect: 'shield', power: 1 },
        { key: 'transmutacao', level: 8, mana: 25, effect: 'gold', power: 20 },
        { key: 'meteoro', level: 11, mana: 35, effect: 'strike', power: 24 },
      ],
      arqueiro: [
        { key: 'tiro_certeiro', level: 3, mana: 10, effect: 'strike', power: 8 },
        { key: 'camuflagem', level: 5, mana: 25, effect: 'stealth', power: 1 },
        { key: 'cacada', level: 8, mana: 20, effect: 'gold', power: 15 },
        { key: 'chuva_de_flechas', level: 11, mana: 30, effect: 'strike', power: 20 },
      ],
      paladino: [
        { key: 'luz_curativa', level: 3, mana: 15, effect: 'heal', power: 15 },
        { key: 'egide', level: 5, mana: 20, effect: 'shield', power: 1 },
        { key: 'bencao_do_grupo', level: 8, mana: 25, effect: 'healClan', power: 10 },
        { key: 'julgamento', level: 11, mana: 30, effect: 'strike', power: 18 },
      ],
      ladino: [
        { key: 'punhalada', level: 3, mana: 10, effect: 'strike', power: 8 },
        { key: 'sombras', level: 5, mana: 30, effect: 'stealth', power: 2 },
        { key: 'bater_carteira', level: 8, mana: 15, effect: 'gold', power: 15 },
        { key: 'emboscada', level: 11, mana: 30, effect: 'strike', power: 22 },
      ],
    },
  },
} as const;

export type GamificationConfig = typeof gamificationConfig;
