import { achievementText } from './achievements';
import { tr } from './i18n-ref';
import { gamificationConfig } from './gamification.config';

/** XP para passar do nível `level` para o seguinte (espelho de public.xp_to_next no banco). */
export function xpToNext(level: number) {
  const { base, exponent } = gamificationConfig.level;
  return Math.round(base * Math.pow(level, exponent));
}

/** Bônus de XP de quem renasceu, 0 a 0,25 (espelho de public.rebirth_bonus). */
export function rebirthBonus(rebirths: number) {
  const { bonusPerRebirth, maxBonus } = gamificationConfig.rebirth;
  return Math.min(Math.max(0, rebirths) * bonusPerRebirth, maxBonus);
}

/** Nível a partir do XP total, com quanto já foi feito do nível atual (espelho de public.level_for_xp). */
export function levelFromXp(xp: number) {
  let level = 1;
  let rest = Math.max(0, xp);
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level += 1;
  }
  return { level, intoLevel: rest, forNext: xpToNext(level) };
}

type BossHp = { hp: number; max_hp: number; status: string } | null | undefined;

/**
 * Aviso de uma conclusão: "+10 XP · ⚔️ 11 de dano · dia 49/60 · semana 289/300 · 🪙 +2 · 🎉 Nível 3!
 * · 🏆 Boss do dia derrotado! · 🎁 👑 Coroa · 🌱 Primeiro passo" (null se nada). Com um teto do dia
 * atingido, diz isso no fim (O3, V4 §1.3).
 */
export function rewardMessage(summary: {
  xp: number;
  level: number | null;
  level_up: boolean;
  boss_defeated: boolean;
  achievements: { key?: string; name: string; icon: string }[];
  damage?: number;
  crit?: boolean;
  heal?: number;
  gold?: number;
  drops?: { name: string; icon: string }[];
  loot?: { kind: string; key: string }[] | null;
  pending?: boolean;
  bosses?: { daily?: BossHp; weekly?: BossHp } | null;
  defeated_now?: string[] | null;
  limit?: string | null;
}) {
  const parts: string[] = [];
  if (summary.pending) return summary.xp > 0 ? tr('reward.pending', { xp: summary.xp }) : null;
  if (summary.xp > 0) parts.push(tr('reward.xp', { xp: summary.xp }));
  const hit = (summary.damage ?? 0) > 0;
  if (hit)
    parts.push(tr(summary.crit ? 'reward.crit' : 'reward.damage', { damage: summary.damage }));
  if (summary.heal && summary.heal > 0) parts.push(tr('reward.heal', { heal: summary.heal }));
  // Como ficaram as barras do dia e da semana (só as que ainda estão de pé)
  if (hit || (summary.heal ?? 0) > 0) {
    const { daily, weekly } = summary.bosses ?? {};
    if (daily?.status === 'active')
      parts.push(tr('reward.dailyHp', { hp: daily.hp, max: daily.max_hp }));
    if (weekly?.status === 'active')
      parts.push(tr('reward.weeklyHp', { hp: weekly.hp, max: weekly.max_hp }));
  }
  if (summary.gold && summary.gold > 0) parts.push(tr('reward.gold', { gold: summary.gold }));
  if (summary.level_up && summary.level) parts.push(tr('reward.levelUp', { level: summary.level }));
  const fallen = summary.defeated_now ?? [];
  if (fallen.length) {
    for (const scope of ['daily', 'user', 'clan', 'quest'])
      if (fallen.includes(scope)) parts.push(tr(`reward.defeated_${scope}`));
  } else if (summary.boss_defeated) parts.push(tr('reward.bossDefeated'));
  for (const d of summary.drops ?? [])
    parts.push(tr('reward.drop', { icon: d.icon, name: d.name }));
  for (const l of summary.loot ?? []) parts.push(lootText(l));
  for (const a of summary.achievements) parts.push(`${a.icon} ${achievementText(a).name}`);
  if (summary.limit === 'quick') parts.push(tr('reward.limitQuick'));
  if (summary.limit === 'habit')
    parts.push(tr('reward.limitHabit', { count: gamificationConfig.antiFarm.habitPlusDailyCap }));
  return parts.length ? parts.join(' · ') : null;
}

/** Nome de um item de mascote ou missão (HB8, HB9): "🥚 Ovo de lobo", "📜 Missão: Rei Esqueleto". */
export function lootText(l: { kind: string; key: string }) {
  switch (l.kind) {
    case 'egg':
      return tr('pets.lootEgg', { name: tr(`pets.species.${l.key}` as 'pets.species.lobo') });
    case 'potion':
      return tr('pets.lootPotion', { name: tr(`pets.potions.${l.key}` as 'pets.potions.comum') });
    case 'food':
      return tr('pets.lootFood', { name: tr(`pets.foods.${l.key}` as 'pets.foods.carne') });
    default:
      return tr('pets.lootScroll', { name: tr(`quests.${l.key}.name` as 'quests.rei-esqueleto.name') });
  }
}
