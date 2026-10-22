import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BossLine, ProgressBar } from '@/components/game-bar';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { Chip } from '@/components/ui/chip';
import { ToggleRow } from '@/components/ui/toggle-row';
import { getGameSounds, setGameSounds } from '@/lib/prefs';
import { useSetGamePref } from '@/lib/queries/game-mode';
import { useState } from 'react';
import { achievementText } from '@/lib/achievements';
import { cn } from '@/lib/cn';
import { rebirthBonus } from '@/lib/gamification';
import { useGameLevel, useGameState, useSetGameLevel, type GameLevel } from '@/lib/queries/game';
import { useIsOnline } from '@/providers/online';

const LEVELS: GameLevel[] = ['off', 'light', 'full'];

/** Configurações → Recursos: os três níveis de jogo (HB3) e, no RPG, vocabulário e sons. */
export function GameLevelSettings() {
  const { t } = useTranslation();
  const { data: game } = useGameState();
  const level = useGameLevel();
  const setLevel = useSetGameLevel();
  const online = useIsOnline();
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-ink">{t('gameProfile.toggle')}</Text>
      <View
        className="flex-row flex-wrap gap-2"
        accessibilityRole="radiogroup"
        accessibilityLabel={t('gameProfile.toggle')}
      >
        {LEVELS.map((value) => (
          <Chip
            key={value}
            role="radio"
            label={t(`gameProfile.levels.${value}`)}
            selected={level === value}
            disabled={!online}
            onPress={() => setLevel.mutate(value)}
          />
        ))}
      </View>
      <Text className="text-sm text-ink-muted">{t(`gameProfile.levelHints.${level}`)}</Text>
      {level === 'full' && game && <FullModeToggles vocab={game.vocab} />}
    </View>
  );
}

/** Jogo (D257): números do jogo em mono, bosses e as conquistas mais recentes. */
export function GameProfile() {
  const { t } = useTranslation();
  const { data: game } = useGameState();
  if (!game) return null;
  const unlocked = game.achievements.filter((a) => a.unlocked_at).length;

  return (
    <View className="gap-4">
      {game.enabled && (
        <>
          <View className="gap-2">
            <View className="flex-row items-baseline justify-between">
              <Text className="font-serif text-lg text-ink">
                {t('gameProfile.level', { level: game.level })}
                {game.rebirths > 0 && (
                  <Text className="font-mono text-xs text-ink-muted">
                    {'  '}🔥{' '}
                    {t('rebirth.count', {
                      count: game.rebirths,
                      bonus: Math.round(rebirthBonus(game.rebirths) * 100),
                    })}
                  </Text>
                )}
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
              {/* As 4 mais recentes; todas, com raridade e filtros, na tela de conquistas (P3) */}
              {game.achievements
                .filter((a) => a.unlocked_at)
                .sort((a, b) => (b.unlocked_at ?? '').localeCompare(a.unlocked_at ?? ''))
                .slice(0, 4)
                .map((a) => {
                  const { name, description } = achievementText(a);
                  return (
                    <View
                      key={a.key}
                      accessibilityLabel={t(
                        a.unlocked_at
                          ? 'gameProfile.achievementLabel'
                          : 'gameProfile.achievementLocked',
                        { name, description },
                      )}
                      className={cn(
                        'min-h-12 w-full flex-row items-center gap-3 border-b border-line py-2 md:w-1/2 md:pr-4',
                        !a.unlocked_at && 'opacity-40',
                      )}
                    >
                      {/* Ícone da conquista: conteúdo do jogo, como o personagem */}
                      <Text className="w-6 text-center text-base">
                        {a.unlocked_at ? a.icon : '·'}
                      </Text>
                      <View className="flex-1">
                        <Text className="text-sm text-ink">{name}</Text>
                        <Text className="text-xs text-ink-muted">{description}</Text>
                      </View>
                    </View>
                  );
                })}
            </View>
            <Button
              variant="ghost"
              label={t('achievements.seeAll')}
              onPress={() => router.push('/conquistas')}
            />
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

/** Modo Completo: vocabulário de jogo (no servidor) e sons (no aparelho). */
function FullModeToggles({ vocab }: { vocab: boolean }) {
  const { t } = useTranslation();
  const online = useIsOnline();
  const pref = useSetGamePref();
  const [sounds, setSounds] = useState(getGameSounds);
  return (
    <View className="gap-2">
      <ToggleRow
        title={t('game.vocab')}
        hint={t('game.vocabHint')}
        value={vocab}
        disabled={!online}
        onChange={(value) => pref.mutate({ game_vocab: value })}
      />
      <ToggleRow
        title={t('gameProfile.sounds')}
        hint={t('gameProfile.soundsHint')}
        value={sounds}
        onChange={(value) => {
          setGameSounds(value);
          setSounds(value);
        }}
      />
    </View>
  );
}
