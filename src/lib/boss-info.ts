import { bossHpForLevel, dailyBossHp } from '@/lib/character';
import { gamificationConfig as config } from '@/lib/gamification.config';

type BossLike = { scope?: string; level?: number; ends_at: string };

/**
 * O que vencer dá (espelho do `_sync_boss_rewards`): XP, ouro do nível e item (no do dia, só uma
 * chance), mais o HP do próximo, que sobe um nível. Só os bosses com nível (do dia e da semana);
 * os de clã, projeto e missão têm regra própria e ficam sem.
 */
export function bossReward(boss: BossLike) {
  const level = boss.level ?? 1;
  if (boss.scope === 'daily') {
    const r = config.dailyBoss;
    return {
      xp: r.rewardXp,
      gold: r.rewardGold + r.rewardGoldPerLevel * (level - 1),
      dropChance: r.dropChance,
      nextHp: dailyBossHp(level + 1),
    };
  }
  if (!boss.scope || boss.scope === 'user') {
    const r = config.boss;
    return {
      xp: r.rewardXp,
      gold: r.rewardGold + r.rewardGoldPerLevel * (level - 1),
      dropChance: 1,
      nextHp: bossHpForLevel(level + 1),
    };
  }
  return null;
}

/** Horas inteiras até o boss fugir (ends_at é o fim do último dia); 0 se já passou. */
export function bossHoursLeft(endsAt: string, now: number) {
  return Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 3_600_000));
}
