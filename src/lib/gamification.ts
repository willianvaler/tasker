import { gamificationConfig } from './gamification.config';

/** XP para passar do nível `level` para o seguinte (espelho de public.xp_to_next no banco). */
export function xpToNext(level: number) {
  const { base, exponent } = gamificationConfig.level;
  return Math.round(base * Math.pow(level, exponent));
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

/** "+10 XP · ⚔️ 5 de dano · 🪙 2 · 🎉 Nível 3! · ⚔️ Boss derrotado! · 🎁 Coroa · 🌱 Primeiro passo" (null se nada). */
export function rewardMessage(summary: {
  xp: number;
  level: number | null;
  level_up: boolean;
  boss_defeated: boolean;
  achievements: { name: string; icon: string }[];
  damage?: number;
  crit?: boolean;
  heal?: number;
  gold?: number;
  drops?: { name: string; icon: string }[];
  pending?: boolean;
}) {
  const parts: string[] = [];
  if (summary.pending) return summary.xp > 0 ? `+~${summary.xp} XP (pendente)` : null;
  if (summary.xp > 0) parts.push(`+${summary.xp} XP`);
  if (summary.damage && summary.damage > 0)
    parts.push(
      summary.crit ? `💥 ${summary.damage} de dano (crítico!)` : `⚔️ ${summary.damage} de dano`,
    );
  if (summary.heal && summary.heal > 0) parts.push(`💚 o boss curou ${summary.heal}`);
  if (summary.gold && summary.gold > 0) parts.push(`🪙 +${summary.gold}`);
  if (summary.level_up && summary.level) parts.push(`🎉 Nível ${summary.level}!`);
  if (summary.boss_defeated) parts.push('🏆 Boss derrotado!');
  for (const d of summary.drops ?? []) parts.push(`🎁 ${d.icon} ${d.name}`);
  for (const a of summary.achievements) parts.push(`${a.icon} ${a.name}`);
  return parts.length ? parts.join(' · ') : null;
}
