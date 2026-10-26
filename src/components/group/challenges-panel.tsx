import type { TFunction } from 'i18next';
import { Link } from 'expo-router';
import { Flame, Plus, Trophy } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ConfirmDialog, PromptDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Avatar } from '@/components/ui/person';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import {
  boardActivity,
  challengeProgress,
  leaderboard,
  podium,
  type BoardEntry,
  type Scoring,
} from '@/lib/gym/leaderboard';
import { formatShortDate } from '@/lib/parser/dates';
import {
  useChallengeActions,
  useChallengeBoard,
  useGroupChallenges,
  type Challenge,
  type Group,
} from '@/lib/queries/challenges';
import { useToday } from '@/lib/queries/profile';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

const endOf = (c: Challenge) => c.ends_on ?? c.starts_on;
const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' } as const;

/**
 * Desafios que saíram do projeto ou do time (V6 §15.5, AC10.5): o que está valendo, com o ranking,
 * os que acabaram e "Iniciar novo desafio" (nome e quantos dias dura; o grupo inteiro entra). Cada
 * um abre a tela do desafio (AC15C), com o mural, o chat e as pessoas.
 */
export function ChallengesPanel({
  group,
  canStart,
  focusId,
}: {
  group: Group;
  canStart: boolean;
  /** Desafio aberto pelo aviso: fica no topo */
  focusId?: string;
}) {
  const { t } = useTranslation();
  const today = useToday();
  const list = useGroupChallenges(group);
  const actions = useChallengeActions(group);
  const toast = useToast();
  const [starting, setStarting] = useState(false);
  const all = list.data ?? [];
  const running = all
    .filter((c) => endOf(c) >= today)
    .sort((a, b) => (a.id === focusId ? -1 : b.id === focusId ? 1 : 0));
  const past = all.filter((c) => endOf(c) < today);

  return (
    <View className="gap-6">
      {canStart && (
        <Button
          icon={Plus}
          label={t('group.newChallenge')}
          className="self-start"
          onPress={() => setStarting(true)}
        />
      )}
      {list.data && all.length === 0 && (
        <EmptyState title={t('group.noChallenges')} hint={t('group.noChallengesHint')} />
      )}
      {running.map((c) => (
        <ChallengeCard key={c.id} challenge={c} canRemove={canStart} link />
      ))}
      {past.length > 0 && (
        <View className="gap-3">
          <SectionLabel title={t('group.pastChallenges')} count={past.length} />
          {past.map((c) => (
            <ChallengeCard key={c.id} challenge={c} canRemove={canStart} compact link />
          ))}
        </View>
      )}
      {starting && (
        <PromptDialog
          title={t('group.newChallenge')}
          confirmLabel={t('group.start')}
          fields={[
            { key: 'name', placeholder: t('group.challengeName'), initial: t('group.defaultName') },
            { key: 'days', placeholder: t('group.challengeDays'), initial: '30' },
          ]}
          onClose={() => setStarting(false)}
          onConfirm={({ name, days }) => {
            const n = Number(days);
            if (!Number.isInteger(n) || n < 1 || n > 365) {
              toast({ message: t('group.daysInvalid') });
              return;
            }
            setStarting(false);
            actions.start.mutate(
              { name, days: n },
              { onError: (e) => toast({ message: t('page.error', { message: e.message }) }) },
            );
          }}
        />
      )}
    </View>
  );
}

/** O valor do critério de uma linha: "12 dias", "5 treinos", "340 min", "86 pts". */
export function scoreLabel(entry: BoardEntry, scoring: Scoring, t: TFunction) {
  return t(`challenge.score.${scoring}`, { count: entry.score });
}

/** Ranking de um desafio, com o pódio quando terminou. */
export function ChallengeCard({
  challenge,
  canRemove,
  compact,
  link,
  bare,
}: {
  challenge: Challenge;
  canRemove: boolean;
  compact?: boolean;
  /** O nome abre a tela do desafio */
  link?: boolean;
  /** Sem o nome (a tela do desafio já o tem no topo) */
  bare?: boolean;
}) {
  const { t } = useTranslation();
  const today = useToday();
  const me = useSession().session?.user.id;
  const board = useChallengeBoard(challenge.id);
  const actions = useChallengeActions(null);
  const [removing, setRemoving] = useState(false);
  const range = { start: challenge.starts_on, end: endOf(challenge), today };
  const progress = challengeProgress(range);
  const rows = board.data ?? [];
  const names = new Map(rows.map((r) => [r.user_id, r.display_name]));
  const entries = leaderboard(
    boardActivity(rows),
    rows.map((r) => r.user_id),
    range,
    challenge.scoring,
  );
  const shown = compact ? entries.slice(0, 3) : entries;
  // Terminado (AC11): o pódio leva o prêmio, entregue pelo servidor no dia seguinte ao fim
  const over = today > range.end;
  const places = over ? podium(entries) : new Map<string, 1 | 2 | 3>();
  const title = (
    <Text accessibilityRole="header" className="text-base font-semibold text-ink">
      {challenge.name}
    </Text>
  );

  return (
    <View className="gap-3 rounded-lg border border-line bg-surface p-4">
      <View className="flex-row items-start gap-3">
        <Icon icon={Trophy} tone="ink" />
        <View className="flex-1 gap-1">
          {bare ? null : link ? (
            <Link href={{ pathname: '/desafio/[id]', params: { id: challenge.id } }} asChild>
              <Pressable accessibilityRole="link" className="self-start hover:opacity-80">
                {title}
              </Pressable>
            </Link>
          ) : (
            title
          )}
          <Text className="font-mono text-xs text-ink-muted">
            {formatShortDate(range.start)} – {formatShortDate(range.end)} ·{' '}
            {progress.left > 0
              ? t('group.dayOf', { day: progress.elapsed, total: progress.total })
              : t('group.finished')}
          </Text>
        </View>
        {canRemove && (
          <Button
            destructive
            variant="ghost"
            label={t('group.removeChallenge')}
            onPress={() => setRemoving(true)}
          />
        )}
      </View>
      {!compact && (
        <ProgressBar
          value={progress.total ? progress.elapsed / progress.total : 0}
          label={t('group.dayOf', { day: progress.elapsed, total: progress.total })}
        />
      )}
      <View accessibilityRole="list" aria-label={t('group.ranking')}>
        {shown.map((entry) => {
          const name = names.get(entry.userId) ?? t('common.someone');
          return (
            <View
              key={entry.userId}
              accessibilityRole="text"
              accessibilityLabel={t('challenge.rankRow', {
                rank: entry.rank,
                name,
                score: scoreLabel(entry, challenge.scoring, t),
              })}
              className={cn(
                'min-h-10 flex-row items-center gap-3 border-b border-line px-2',
                entry.userId === me && 'bg-wash',
              )}
            >
              <Text className="w-6 text-right font-mono text-sm text-ink-muted">{entry.rank}</Text>
              <Avatar name={name} size={20} />
              <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
                {name}
              </Text>
              {places.has(entry.userId) && (
                <Text
                  accessibilityLabel={t('group.medal', { place: places.get(entry.userId) })}
                  className="text-base"
                >
                  {MEDALS[places.get(entry.userId) ?? 3]}
                </Text>
              )}
              {entry.streak > 1 && (
                <View className="flex-row items-center gap-1">
                  <Icon icon={Flame} tone="ink-muted" />
                  <Text className="font-mono text-xs text-ink-muted">{entry.streak}</Text>
                </View>
              )}
              <Text className="font-mono text-sm text-ink">
                {scoreLabel(entry, challenge.scoring, t)}
              </Text>
            </View>
          );
        })}
      </View>
      {!compact && (
        <Text className="text-xs text-ink-muted">{t(`challenge.rule.${challenge.scoring}`)}</Text>
      )}
      {!compact && <Text className="text-xs text-ink-muted">{t('group.prizes')}</Text>}
      {removing && (
        <ConfirmDialog
          title={t('group.removeTitle', { name: challenge.name })}
          message={t('group.removeMessage')}
          confirmLabel={t('group.removeChallenge')}
          destructive
          onClose={() => setRemoving(false)}
          onConfirm={() => {
            setRemoving(false);
            actions.remove.mutate(challenge.id);
          }}
        />
      )}
    </View>
  );
}
