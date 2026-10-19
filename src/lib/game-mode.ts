// Modo jogo Completo (ESCOPO_V8): contas e chaves que a tela mostra. Quem decide é o banco
// (20261156000000_modo_jogo.sql); estas funções espelham as regras para a tela, com testes.
import { gamificationConfig } from './gamification.config';

const game = gamificationConfig.game;

export type ManaSkill = (typeof game.manaSkills)[keyof typeof game.manaSkills][number];

/** As 4 habilidades de mana da classe (vazio sem classe). */
export function manaSkillsFor(cls: string | null): readonly ManaSkill[] {
  return cls && cls in game.manaSkills ? game.manaSkills[cls as keyof typeof game.manaSkills] : [];
}

/** Dano do golpe (efeito strike): poder + Força, como no cast_mana_skill. */
export function strikeDamage(skill: ManaSkill, str: number) {
  return skill.effect === 'strike' ? skill.power + str : 0;
}

/** Por que não dá para usar agora (ou null se dá). */
export function manaSkillBlock(
  skill: ManaSkill,
  state: { level: number; mp: number; dead: boolean },
): 'level' | 'mana' | 'dead' | null {
  if (state.dead) return 'dead';
  if (state.level < skill.level) return 'level';
  if (state.mp < skill.mana) return 'mana';
  return null;
}

/** Chave da arte do retrato: classe + variação escolhida (a primeira, se não escolheu). */
export function portraitKey(cls: string | null, variant: string | undefined) {
  if (!cls) return null;
  const v = variant && (game.portraits as readonly string[]).includes(variant) ? variant : game.portraits[0];
  return `${cls}-${v}`;
}

/** "lobo:gelo" → { species, potion } (mascote e montaria ativos). */
export function parseCompanion(value: string | null | undefined) {
  if (!value) return null;
  const [species, potion] = value.split(':');
  return species && potion ? { species, potion } : null;
}

/** Comida favorita de um mascote (a da cor da poção). */
export function favoriteFood(potion: string) {
  return (game.pets.foods as Record<string, string>)[potion] ?? null;
}

/** Quanto falta para virar montaria, de 0 a 1. */
export function mountProgress(fed: number) {
  return Math.min(1, fed / game.feedToMount);
}
