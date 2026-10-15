-- V4 §1.2 (O2): calibragem do dano. "Antes estava muito alto, agora está muito baixo": os golpes
-- ficam 2,5× maiores (tarefa 10, hábito 8, item 5, página 20, "+" 5; a cura do "−" e o teto de dano
-- das rápidas na mesma proporção) e o HP do semanal também (300 no nível 1, os mesmos ~5 dias de
-- uso). O diário (O1) fica com 60 HP (umas 6 tarefas): cada golpe tira ~15% da barra.
-- Os semanais e do clã desta semana ficam como estão (acabam no domingo); os diários de hoje
-- acompanham a escala nova.

create or replace function public.xp_rules()
returns jsonb
language sql immutable set search_path = ''
as $$
  select $json$
{
  "xp": {
    "task": 10,
    "priorityMultiplier": [
      1,
      1,
      1.25,
      1.5
    ],
    "habit": 8,
    "streakBonusPerDay": 1,
    "streakBonusMax": 20,
    "checklistItem": 5,
    "pageBonus": 25,
    "pageBonusMinItems": 3,
    "habitPlus": 3,
    "pomodoro": 5
  },
  "antiFarm": {
    "tooFastSeconds": 30,
    "quickSeconds": 300,
    "dailyQuickCap": 50,
    "dailyQuickDamageCap": 50,
    "habitPlusDailyCap": 10,
    "pomodoroDailyCap": 4,
    "pomodoroMinMinutes": 15
  },
  "level": {
    "base": 100,
    "exponent": 1.4
  },
  "boss": {
    "hpBase": 300,
    "hpGrowth": 1.2,
    "recentWeeks": 4,
    "recentFactor": 0.8,
    "rewardXp": 50,
    "rewardGold": 20,
    "rewardGoldPerLevel": 10,
    "noDropGold": 25
  },
  "dailyBoss": {
    "hpBase": 60,
    "hpGrowth": 1.05,
    "hpMaxFactor": 3,
    "recentDays": 14,
    "recentFactor": 0.7,
    "rewardXp": 15,
    "rewardGold": 5,
    "rewardGoldPerLevel": 1,
    "noDropGold": 5,
    "dropChance": 0.15
  },
  "damage": {
    "task": 10,
    "habit": 8,
    "checklistItem": 5,
    "pageBonus": 20,
    "habitPlus": 5,
    "habitMinusHeal": 8,
    "perPoint": 0.05,
    "critPerAgi": 0.02,
    "critMax": 0.6,
    "critMultiplier": 2,
    "weightStep": 0.25
  },
  "gold": {
    "task": 2,
    "habit": 1,
    "checklistItem": 1,
    "pageBonus": 5,
    "habitPlus": 1,
    "perCon": 0.03
  },
  "attributes": {
    "base": 1,
    "pointsPerLevel": 1,
    "healReducePerCon": 0.08,
    "healReduceMax": 0.8
  },
  "classes": {
    "lutador": {
      "str": 3,
      "agi": 0,
      "int": 0,
      "con": 1
    },
    "mago": {
      "str": 0,
      "agi": 1,
      "int": 3,
      "con": 0
    },
    "arqueiro": {
      "str": 1,
      "agi": 3,
      "int": 0,
      "con": 0
    },
    "paladino": {
      "str": 0,
      "agi": 0,
      "int": 1,
      "con": 3
    },
    "ladino": {
      "str": 1,
      "agi": 2,
      "int": 0,
      "con": 1
    }
  },
  "skills": {
    "firstStrikeMultiplier": 2,
    "streakFocusPerDay": 0.02,
    "streakFocusMax": 0.3,
    "archerCritMultiplier": 2.5,
    "paladinHealReduce": 0.5,
    "rogueGoldBonus": 0.5,
    "furyBonus": 0.5,
    "stormBonus": 0.5,
    "aimCritBonus": 0.25,
    "blessingBonus": 0.3,
    "ambushMultiplier": 2
  },
  "habits": {
    "maxTarget": 100
  }
}
  $json$::jsonb;
$$;

update public.bosses set max_hp = max_hp * 5 / 2 where scope = 'daily' and status = 'active';
select public._settle_boss(id) from public.bosses where scope = 'daily' and status = 'active';
