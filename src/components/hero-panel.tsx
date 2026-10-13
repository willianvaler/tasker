import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Avatar, classOf } from '@/components/character';
import { BossLine } from '@/components/game-bar';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Text } from '@/components/ui/text';
import { CLASSES } from '@/lib/character';
import { useGameState, useUseSkill, type GameState } from '@/lib/queries/game';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

/** Painel do personagem (Hoje e Início no computador): nível, habilidade do dia e os bosses. */
export function HeroPanel() {
  const { data: game } = useGameState();
  if (!game?.enabled) return null;
  const cls = classOf(game);
  return (
    <View aria-label="Personagem e boss da semana" className="gap-4">
      <View className="gap-3 rounded-lg border border-line bg-surface p-4">
        <Link href="/character" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Abrir personagem"
            className="flex-row items-center gap-3 active:opacity-80"
          >
            <Avatar game={game} size="md" />
            <View className="flex-1 gap-1">
              <Text className="text-base font-semibold text-ink">
                {cls ? `${CLASSES[cls].icon} ${CLASSES[cls].name}` : '🧭 Escolha sua classe'} · Nv{' '}
                {game.level}
              </Text>
              <ProgressBar
                value={game.into_level / game.for_next}
                label={`Nível ${game.level}: ${game.into_level} de ${game.for_next} XP`}
              />
              <Text className="text-xs text-ink-muted">
                {game.into_level}/{game.for_next} XP · 🔥 {game.streak} · 🪙 {game.gold}
                {(game.points ?? 0) > 0 ? ` · ✨ ${game.points} ponto(s)` : ''}
              </Text>
            </View>
          </Pressable>
        </Link>
        {cls && <SkillButton game={game} />}
      </View>
      {game.boss && (
        <View className="gap-2 rounded-lg border border-line bg-surface p-4">
          <BossLine boss={game.boss} />
          <Text className="text-xs text-ink-muted">
            ⚔️ {game.damage_today} de dano hoje · 💥 maior golpe: {game.best_hit}
          </Text>
          {game.clan_boss && <BossLine boss={game.clan_boss} prefix="Clã: " />}
        </View>
      )}
    </View>
  );
}

function SkillButton({ game }: { game: GameState }) {
  const use = useUseSkill();
  const online = useIsOnline();
  const toast = useToast();
  const cls = classOf(game);
  if (!cls) return null;
  const skill = CLASSES[cls].active;
  return (
    <Button
      variant={game.skill_active ? 'ghost' : 'primary'}
      label={game.skill_active ? `⚡ ${skill.name} ativa hoje` : `⚡ Usar ${skill.name}`}
      accessibilityHint={skill.text}
      disabled={game.skill_active || !online}
      loading={use.isPending}
      onPress={() =>
        use.mutate(undefined, {
          onSuccess: () => toast({ message: `⚡ ${skill.name}! ${skill.text}` }),
          onError: (e) => toast({ message: `Não deu certo: ${e.message}` }),
        })
      }
    />
  );
}
