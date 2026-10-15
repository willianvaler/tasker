import { Link } from 'expo-router';
import { Zap } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
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

/**
 * Personagem e bosses na coluna da direita do Início (computador): nível, XP e ouro em mono, a
 * habilidade do dia e as faixas dos bosses. Sem caixas: só divisórias finas.
 */
export function HeroPanel() {
  const { t } = useTranslation();
  const { data: game } = useGameState();
  if (!game?.enabled) return null;
  const cls = classOf(game);
  return (
    <View aria-label={t('hero.label')} className="gap-6">
      <View className="gap-3">
        <Link href="/character" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('hero.open')}
            className="-mx-2 flex-row items-center gap-3 rounded px-2 py-1 hover:bg-wash"
          >
            <Avatar game={game} size="md" />
            <View className="flex-1 gap-1">
              <Text className="font-serif text-base text-ink">
                {cls ? CLASSES[cls].name : t('hero.pickClass')}
              </Text>
              <Text className="font-mono text-xs text-ink-muted">
                {t('nav.level', { level: game.level })} ·{' '}
                {t('nav.xp', { into: game.into_level, next: game.for_next })} ·{' '}
                {t('hero.gold', { gold: game.gold })}
              </Text>
            </View>
          </Pressable>
        </Link>
        <ProgressBar
          value={game.into_level / game.for_next}
          label={t('nav.xp', { into: game.into_level, next: game.for_next })}
        />
        {(game.points ?? 0) > 0 && (
          <Text className="font-mono text-xs text-accent">
            {t('hero.points', { count: game.points ?? 0 })}
          </Text>
        )}
        {cls && <SkillButton game={game} />}
      </View>
      {game.boss && (
        <View className="gap-3 border-t border-line pt-4">
          {game.daily_boss && <BossLine boss={game.daily_boss} prefix={t('boss.dailyPrefix')} />}
          {game.daily_streak > 0 && (
            <Text className="font-mono text-xs text-accent">
              {t('boss.dailyStreak', { count: game.daily_streak })}
            </Text>
          )}
          <BossLine
            boss={game.boss}
            prefix={game.daily_boss ? t('boss.weeklyPrefix') : undefined}
          />
          <Text className="font-mono text-xs text-ink-muted">
            {t('hero.damageToday', { damage: game.damage_today, best: game.best_hit })}
          </Text>
          {game.clan_boss && <BossLine boss={game.clan_boss} prefix={t('boss.clanPrefix')} />}
        </View>
      )}
    </View>
  );
}

function SkillButton({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const use = useUseSkill();
  const online = useIsOnline();
  const toast = useToast();
  const cls = classOf(game);
  if (!cls) return null;
  const skill = CLASSES[cls].active;
  return (
    <Button
      variant={game.skill_active ? 'ghost' : 'primary'}
      icon={Zap}
      label={t(game.skill_active ? 'hero.skillActive' : 'hero.useSkill', { skill: skill.name })}
      accessibilityHint={skill.text}
      disabled={game.skill_active || !online}
      loading={use.isPending}
      className="self-start"
      onPress={() =>
        use.mutate(undefined, {
          onSuccess: () =>
            toast({ message: t('hero.skillUsed', { skill: skill.name, text: skill.text }) }),
          onError: (e) => toast({ message: t('hero.error', { message: e.message }) }),
        })
      }
    />
  );
}
