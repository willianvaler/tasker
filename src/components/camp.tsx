import { Link, router } from 'expo-router';
import { Gift, PawPrint } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { classOf, useEquippedTitle } from '@/components/character';
import { HeroPortrait, QuestCard, VitalActions, VitalBars } from '@/components/game-mode';
import { Button } from '@/components/ui/button';
import { BossLine } from '@/components/game-bar';
import { SkillButton } from '@/components/hero-panel';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { CLASSES } from '@/lib/character';
import { useGameState, type Boss } from '@/lib/queries/game';

const TAUNTS = 4;

/** Fala curta do boss: fixa por boss (pelo id), e outra quando ele está quase caindo. */
function useTaunt(boss: Boss) {
  const { t } = useTranslation();
  if (boss.status === 'defeated') return null;
  if (boss.hp / boss.max_hp < 0.3) return t('camp.tauntLow');
  let hash = 0;
  for (const ch of boss.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return t(`camp.taunt${(hash % TAUNTS) + 1}` as 'camp.taunt1');
}

function BossCard({ boss, prefix }: { boss: Boss; prefix?: string }) {
  const taunt = useTaunt(boss);
  return (
    <View className="gap-2">
      <BossLine boss={boss} prefix={prefix} />
      {taunt && (
        // Alinha com o nome: o espaço da arte (28 px) e o mesmo gap-3 da faixa do boss
        <View className="flex-row gap-3">
          <View style={{ width: 28 }} />
          <Text className="flex-1 font-serif text-sm italic text-ink-muted">“{taunt}”</Text>
        </View>
      )}
    </View>
  );
}

/**
 * Início no modo Completo (HB4, ESCOPO_V8 §3): o acampamento. Personagem em destaque, barra de XP,
 * ouro e pontos; os bosses do dia, da semana e do clã com uma fala; e as missões abertas de hoje.
 * Vida e mana entram com o HB5 e o HB6. A arte é provisória (emoji e traço), até os lotes do ComfyUI.
 */
export function CampView({ name, missions }: { name?: string; missions: number }) {
  const { t } = useTranslation();
  const { data: game } = useGameState();
  const title = useEquippedTitle(game);
  if (!game?.enabled) return null;
  const cls = classOf(game);
  return (
    <View aria-label={t('camp.label')} className="gap-6 border-b border-line pb-6">
      <View className="flex-row items-center gap-4">
        <Link href="/character" asChild>
          <Pressable accessibilityRole="link" accessibilityLabel={t('hero.open')}>
            <HeroPortrait game={game} />
          </Pressable>
        </Link>
        <View className="flex-1 gap-2">
          <View className="gap-1">
            <Text accessibilityRole="header" className="font-serif text-xl text-ink">
              {name ?? t('camp.hero')}
            </Text>
            <Text className="font-mono text-xs text-ink-muted">
              {[
                cls ? CLASSES[cls].name : t('hero.pickClass'),
                title,
                t('nav.level', { level: game.level }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
          <View className="gap-1">
            <ProgressBar
              value={game.into_level / game.for_next}
              label={t('nav.xp', { into: game.into_level, next: game.for_next })}
            />
            <Text className="font-mono text-xs text-ink-muted">
              {t('nav.xp', { into: game.into_level, next: game.for_next })} ·{' '}
              {t('hero.gold', { gold: game.gold })}
              {(game.points ?? 0) > 0 ? ` · ${t('hero.points', { count: game.points ?? 0 })}` : ''}
            </Text>
          </View>
          <VitalBars game={game} />
          {cls && <SkillButton game={game} />}
        </View>
      </View>
      <VitalActions game={game} />
      <View className="flex-row flex-wrap gap-2">
        <Button
          variant="ghost"
          icon={Gift}
          label={t('game.rewardsLink')}
          onPress={() => router.push('/recompensas')}
        />
        <Button
          variant="ghost"
          icon={PawPrint}
          label={t('game.stableLink')}
          onPress={() => router.push('/estabulo')}
        />
      </View>
      {game.quests.map((q) => (
        <QuestCard key={q.id} quest={q} />
      ))}

      {(game.daily_boss || game.boss || game.clan_boss) && (
        <View className="gap-4">
          <SectionLabel title={t('camp.bosses')} />
          {game.daily_boss && <BossCard boss={game.daily_boss} prefix={t('boss.dailyPrefix')} />}
          {game.boss && <BossCard boss={game.boss} prefix={t('boss.weeklyPrefix')} />}
          {game.clan_boss && <BossCard boss={game.clan_boss} prefix={t('boss.clanPrefix')} />}
        </View>
      )}

      <Text className="font-mono text-xs text-ink-muted">
        {missions > 0 ? t('camp.missions', { count: missions }) : t('camp.missionsDone')}
      </Text>
    </View>
  );
}
