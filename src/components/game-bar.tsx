import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Avatar } from '@/components/character';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { usePendingXp } from '@/lib/sync/pending-xp';
import { useGameState, type Boss } from '@/lib/queries/game';
import { useColors } from '@/lib/tokens';

export { ProgressBar };

/** Arte única dos bosses: um traço só, estilo carimbo, a mesma para todos. */
export function BossArt({ size = 28 }: { size?: 28 | 48 }) {
  const colors = useColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      <Path
        d="M5 22c0-6 3-10 9-10s9 4 9 10M9 12 7 5l5 4 2-5 2 5 5-4-2 7M11 17h.01M17 17h.01M11 21h6"
        stroke={colors.ink}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * Faixa do boss: nome serifado, nível em mono, linha de HP de 2 px e
 * `120/120 HP`. Solo e clã são semanais; o de projeto tem prazo e conta tarefas.
 */
export function BossLine({ boss, prefix }: { boss: Boss; prefix?: string }) {
  const { t, i18n } = useTranslation();
  const scope = boss.scope ?? 'user';
  const name = prefix ? `${prefix}: ${boss.name}` : boss.name;
  if (boss.status === 'defeated') {
    const tail = {
      user: 'boss.defeatedUser',
      daily: 'boss.defeatedDaily',
      clan: 'boss.defeatedClan',
      folder: 'boss.defeatedFolder',
    } as const;
    return (
      <View className="flex-row items-center gap-3">
        <BossArt />
        <Text className="flex-1 text-sm text-ink">
          {t('boss.defeated', { name })} {t(tail[scope])}
        </Text>
      </View>
    );
  }
  // ends_at é o fim do último dia (00:00 do dia seguinte)
  const lastDay = new Date(new Date(boss.ends_at).getTime() - 1);
  const when = new Intl.DateTimeFormat(
    i18n.language,
    scope === 'folder' ? { day: '2-digit', month: '2-digit' } : { weekday: 'long' },
  ).format(lastDay);
  const unit = t(scope === 'folder' ? 'boss.unitTasks' : 'boss.unitHp');
  return (
    <View className="flex-row items-center gap-3">
      <BossArt />
      <View className="flex-1 gap-1">
        <View className="flex-row items-baseline gap-2">
          <Text className="shrink font-serif text-base text-ink" numberOfLines={1}>
            {name}
          </Text>
          {scope !== 'folder' && boss.level ? (
            <Text className="shrink-0 font-mono text-xs text-ink-muted">
              {t('boss.level', { level: boss.level })}
            </Text>
          ) : null}
          <Text className="ml-auto shrink-0 font-mono text-xs text-ink-muted">
            {scope === 'folder'
              ? t('boss.tasksLeft', { hp: boss.hp, max: boss.max_hp })
              : t('boss.hp', { hp: boss.hp, max: boss.max_hp })}
          </Text>
        </View>
        <ProgressBar
          value={boss.hp / boss.max_hp}
          label={t('boss.label', { name: boss.name, hp: boss.hp, max: boss.max_hp, unit })}
        />
        <Text className="font-mono text-xs text-ink-muted">
          {boss.status === 'escaped'
            ? t('boss.escaped')
            : scope === 'daily'
              ? t('boss.untilMidnight')
              : t('boss.until', { when })}
        </Text>
      </View>
    </View>
  );
}

/**
 * Resumo do jogo no topo da Hoje e do Início: nível e XP em mono com o fio de 2 px, sequência, e a
 * faixa do boss da semana (e do clã). Discreto: marcação, não um jogo por cima.
 */
export function GameHeader() {
  const { t } = useTranslation();
  const { data: game } = useGameState();
  if (!game?.enabled) return null;
  return (
    <Link href="/character" asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('boss.gameLink')}
        className="-mx-2 gap-3 rounded border-y border-line px-2 py-3 hover:bg-wash active:bg-wash"
      >
        <View className="flex-row items-center gap-3">
          <Text className="font-mono text-xs text-ink">
            {t('nav.level', { level: game.level })}
          </Text>
          <ProgressBar
            className="flex-1"
            value={game.into_level / game.for_next}
            label={`${game.into_level}/${game.for_next} XP`}
          />
          <Text className="font-mono text-xs text-ink-muted">
            {game.into_level}/{game.for_next} XP
          </Text>
          <PendingXp />
          <Text
            className={cn('font-mono text-xs', game.active_today ? 'text-ink' : 'text-ink-muted')}
            accessibilityLabel={t('boss.streak', { count: game.streak })}
          >
            {t('boss.streakShort', { count: game.streak })}
          </Text>
        </View>
        {/* O4: o do dia vem antes do da semana */}
        {game.daily_boss && <BossLine boss={game.daily_boss} prefix={t('boss.dailyPrefix')} />}
        {game.boss && (
          <BossLine
            boss={game.boss}
            prefix={game.daily_boss ? t('boss.weeklyPrefix') : undefined}
          />
        )}
        {game.clan_boss && <BossLine boss={game.clan_boss} prefix={t('boss.clanPrefix')} />}
      </Pressable>
    </Link>
  );
}

export function SidebarGame() {
  const { data: game } = useGameState();
  if (!game?.enabled) return null;
  return (
    <Link href="/character" asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Personagem: nível ${game.level}, dias seguidos: ${game.streak}, ${game.gold} de ouro`}
        className="mx-3 mb-3 flex-row items-center gap-3 rounded-lg border border-line bg-paper p-2 active:bg-wash"
      >
        <Avatar game={game} size="sm" />
        <View className="flex-1 gap-1">
          <View className="flex-row items-baseline justify-between">
            <Text className="text-sm font-semibold text-ink">Nível {game.level}</Text>
            <Text className="text-xs text-ink-muted">
              🔥 {game.streak} · 🪙 {game.gold}
            </Text>
          </View>
          <ProgressBar
            value={game.into_level / game.for_next}
            label={`Nível ${game.level}: ${game.into_level} de ${game.for_next} XP`}
          />
          <Text className="text-xs text-ink-muted">
            {game.into_level}/{game.for_next} XP
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

/** XP de ações ainda na fila do sync, estimado; some quando o servidor confirma. */
export function PendingXp() {
  const { t } = useTranslation();
  const xp = usePendingXp();
  if (xp <= 0) return null;
  return <Text className="font-mono text-xs text-accent">{t('boss.pendingXp', { xp })}</Text>;
}
