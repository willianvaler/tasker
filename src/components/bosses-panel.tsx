import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ArtImage, bossArtId } from '@/components/game-art';
import { BossArt } from '@/components/game-bar';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { bossHoursLeft, bossReward } from '@/lib/boss-info';
import { useGameLevel, useGameState, type Boss } from '@/lib/queries/game';

const TAUNTS = 4;

/** Fala curta do boss: fixa por boss (pelo id), e outra quando ele está quase caindo. */
function useTaunt(boss: Boss) {
  const { t } = useTranslation();
  if (boss.status !== 'active') return null;
  if (boss.hp / boss.max_hp < 0.3) return t('camp.tauntLow');
  let hash = 0;
  for (const ch of boss.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return t(`camp.taunt${(hash % TAUNTS) + 1}` as 'camp.taunt1');
}

type Kind = 'daily' | 'weekly' | 'clan';

/**
 * Bosses do Jogo (CD28): um bloco só, no lugar das três listas que repetiam os mesmos bosses
 * (acampamento, coluna dos números e Personagem). Diz primeiro como bater; cada boss tem a vida numa
 * barra grossa com fundo (a linha de 2 px cheia parecia um sublinhado), quanto tempo falta e o que
 * vencer dá.
 */
export function BossesPanel() {
  const { t } = useTranslation();
  const { data: game } = useGameState();
  if (!game?.enabled) return null;
  const bosses = [
    game.daily_boss && { kind: 'daily' as const, boss: game.daily_boss },
    game.boss && { kind: 'weekly' as const, boss: game.boss },
    game.clan_boss && { kind: 'clan' as const, boss: game.clan_boss },
  ].filter((b): b is { kind: Kind; boss: Boss } => !!b);
  if (!bosses.length) return null;
  return (
    <View aria-label={t('bossPanel.label')} className="gap-4">
      <SectionLabel title={t('camp.bosses')} />
      <Text className="text-sm text-ink-muted">{t('bossPanel.how')}</Text>
      <Text className="font-mono text-xs text-ink-muted">
        {t('bossPanel.today', { damage: game.damage_today, best: game.best_hit })}
        {game.daily_streak > 0 ? ` · ${t('boss.dailyStreak', { count: game.daily_streak })}` : ''}
      </Text>
      {bosses.map(({ kind, boss }) => (
        <BossCard key={boss.id} kind={kind} boss={boss} />
      ))}
    </View>
  );
}

function BossCard({ kind, boss }: { kind: Kind; boss: Boss }) {
  const { t, i18n } = useTranslation();
  const full = useGameLevel() === 'full';
  const taunt = useTaunt(boss);
  const art = bossArtId(boss);
  const reward = bossReward(boss);
  const defeated = boss.status === 'defeated';
  const escaped = boss.status === 'escaped';

  // A hora de abrir a tela basta: o texto é "foge em N horas", não um relógio
  const [now] = useState(() => Date.now());
  const hours = bossHoursLeft(boss.ends_at, now);
  // ends_at é o fim do último dia (00:00 do dia seguinte)
  const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: 'long' }).format(
    new Date(new Date(boss.ends_at).getTime() - 1),
  );
  const left =
    hours < 1
      ? t('bossPanel.leftSoon')
      : hours < 24
        ? t('bossPanel.leftHours', { count: hours })
        : t('bossPanel.leftDays', { when: weekday, count: Math.ceil(hours / 24) });

  return (
    <View className="gap-3 rounded-lg border border-line bg-surface p-4">
      <View className="flex-row items-center gap-3">
        {art ? (
          <ArtImage group="bosses" id={art} size={48} fallback={boss.icon} />
        ) : (
          <BossArt size={48} />
        )}
        <View className="flex-1 gap-1">
          <Text className="font-mono text-xs uppercase text-ink-muted">
            {t(`bossPanel.kind.${kind}`)}
            {boss.level ? ` · ${t('boss.level', { level: boss.level })}` : ''}
          </Text>
          <Text className="font-serif text-lg text-ink" numberOfLines={2}>
            {boss.name}
          </Text>
        </View>
      </View>

      {defeated ? (
        <Text className="text-sm text-ok">
          {t('bossPanel.defeated')}{' '}
          {t(
            kind === 'daily'
              ? 'boss.defeatedDaily'
              : kind === 'clan'
                ? 'boss.defeatedClan'
                : 'boss.defeatedUser',
          )}
        </Text>
      ) : (
        <View className="gap-1">
          <View className="flex-row items-baseline justify-between">
            <Text className="text-xs text-ink-muted">{t('bossPanel.life')}</Text>
            <Text className="font-mono text-xs text-ink">
              {t('boss.hp', { hp: boss.hp, max: boss.max_hp })}
            </Text>
          </View>
          <ProgressBar
            value={boss.hp / boss.max_hp}
            thick
            fillClassName="rounded-full bg-danger"
            label={t('boss.label', {
              name: boss.name,
              hp: boss.hp,
              max: boss.max_hp,
              unit: t('boss.unitHp'),
            })}
          />
          <Text className="font-mono text-xs text-ink-muted">
            {escaped ? t('boss.escaped') : left}
          </Text>
        </View>
      )}

      {full && taunt && <Text className="font-serif text-sm italic text-ink-muted">“{taunt}”</Text>}

      {reward && !defeated && (
        <Text className="text-xs text-ink-muted">
          {t(reward.dropChance < 1 ? 'bossPanel.rewardChance' : 'bossPanel.reward', {
            xp: reward.xp,
            gold: reward.gold,
            chance: Math.round(reward.dropChance * 100),
            hp: reward.nextHp,
          })}
        </Text>
      )}
      {kind === 'clan' && !defeated && (
        <Text className="text-xs text-ink-muted">{t('bossPanel.clanHint')}</Text>
      )}
    </View>
  );
}
