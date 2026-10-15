import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BossLine, ProgressBar } from '@/components/game-bar';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import { cn } from '@/lib/cn';
import { useGameState, useSetGamification } from '@/lib/queries/game';
import { useIsOnline } from '@/providers/online';

/** Perfil: liga/desliga, números do jogo em mono, boss e conquistas. */
export function GameProfile() {
  const { t } = useTranslation();
  const { data: game } = useGameState();
  const setEnabled = useSetGamification();
  const online = useIsOnline();
  if (!game) return null;
  const unlocked = game.achievements.filter((a) => a.unlocked_at).length;

  return (
    <View className="gap-4">
      <ToggleRow
        title={t('gameProfile.toggle')}
        hint={t('gameProfile.toggleHint')}
        value={game.enabled}
        disabled={!online}
        onChange={(value) => setEnabled.mutate(value)}
      />

      {game.enabled && (
        <>
          <View className="gap-2">
            <View className="flex-row items-baseline justify-between">
              <Text className="font-serif text-lg text-ink">
                {t('gameProfile.level', { level: game.level })}
              </Text>
              <Text className="font-mono text-xs text-ink-muted">
                {t('gameProfile.totalXp', { xp: game.xp })}
              </Text>
            </View>
            <ProgressBar
              value={game.into_level / game.for_next}
              label={`${game.into_level}/${game.for_next} XP`}
            />
            <Text className="font-mono text-xs text-ink-muted">
              {game.into_level}/{game.for_next} XP ·{' '}
              {t('gameProfile.toNext', {
                xp: game.for_next - game.into_level,
                level: game.level + 1,
              })}
            </Text>
          </View>

          {/* Números numa linha, em mono (sem cartões iguais em grade) */}
          <View className="flex-row flex-wrap gap-x-4 gap-y-1">
            <Stat value={game.streak} label={t('gameProfile.streak')} />
            <Stat value={game.streak_best} label={t('gameProfile.best')} />
            <Stat value={game.tasks_done} label={t('gameProfile.done')} />
            <Stat value={game.xp_today} label={t('gameProfile.xpToday')} />
            <Stat value={game.gold} label={t('gameProfile.gold')} />
          </View>
          <Text className="text-xs text-ink-muted">
            {t(game.freeze_available ? 'gameProfile.freezeOn' : 'gameProfile.freezeOff')}
          </Text>

          {game.daily_boss && (
            <View className="gap-2">
              <SectionLabel title={t('gameProfile.dailyBoss')} className="pt-2" />
              <BossLine boss={game.daily_boss} />
              <Text className="text-xs text-ink-muted">
                {t('boss.dailyHint')}
                {game.daily_streak > 0
                  ? ` ${t('boss.dailyStreak', { count: game.daily_streak })}`
                  : ''}
              </Text>
            </View>
          )}

          {game.boss && (
            <View className="gap-2">
              <SectionLabel title={t('gameProfile.weeklyBoss')} className="pt-2" />
              <BossLine boss={game.boss} />
              <Text className="text-xs text-ink-muted">{t('gameProfile.bossHint')}</Text>
            </View>
          )}

          <View>
            <SectionLabel
              title={t('gameProfile.achievements')}
              count={`${unlocked}/${game.achievements.length}`}
              className="pt-2"
            />
            <View className="flex-row flex-wrap">
              {game.achievements.map((a) => (
                <View
                  key={a.key}
                  accessibilityLabel={t(
                    a.unlocked_at
                      ? 'gameProfile.achievementLabel'
                      : 'gameProfile.achievementLocked',
                    { name: a.name, description: a.description },
                  )}
                  className={cn(
                    'min-h-12 w-full flex-row items-center gap-3 border-b border-line py-2 md:w-1/2 md:pr-4',
                    !a.unlocked_at && 'opacity-40',
                  )}
                >
                  {/* Ícone da conquista: conteúdo do jogo, como o personagem */}
                  <Text className="w-6 text-center text-base">{a.unlocked_at ? a.icon : '·'}</Text>
                  <View className="flex-1">
                    <Text className="text-sm text-ink">{a.name}</Text>
                    <Text className="text-xs text-ink-muted">{a.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <Text className="font-mono text-xs text-ink-muted">
      <Text className="font-mono text-xs text-ink">{value}</Text> {label}
    </Text>
  );
}
