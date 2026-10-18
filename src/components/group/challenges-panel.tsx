import { Flame, Plus, Trophy } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ConfirmDialog, PromptDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Avatar } from '@/components/ui/person';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { challengeProgress, leaderboard } from '@/lib/gym/leaderboard';
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

/**
 * Desafios do grupo (V6 §15.5, AC10.5): o que está valendo, com o ranking de dias de treino, os
 * que acabaram e "Iniciar novo desafio" (nome e quantos dias dura).
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
        <ChallengeCard key={c.id} challenge={c} canRemove={canStart} />
      ))}
      {past.length > 0 && (
        <View className="gap-3">
          <SectionLabel title={t('group.pastChallenges')} count={past.length} />
          {past.map((c) => (
            <ChallengeCard key={c.id} challenge={c} canRemove={canStart} compact />
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

function ChallengeCard({
  challenge,
  canRemove,
  compact,
}: {
  challenge: Challenge;
  canRemove: boolean;
  compact?: boolean;
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
    rows.flatMap((r) => r.days.map((day) => ({ userId: r.user_id, day }))),
    rows.map((r) => r.user_id),
    range,
  );
  const shown = compact ? entries.slice(0, 3) : entries;

  return (
    <View className="gap-3 rounded-lg border border-line bg-surface p-4">
      <View className="flex-row items-start gap-3">
        <Icon icon={Trophy} tone="ink" />
        <View className="flex-1 gap-1">
          <Text accessibilityRole="header" className="text-base font-semibold text-ink">
            {challenge.name}
          </Text>
          <Text className="font-mono text-xs text-ink-muted">
            {formatShortDate(range.start)} – {formatShortDate(range.end)} ·{' '}
            {progress.left > 0
              ? t('group.dayOf', { day: progress.elapsed, total: progress.total })
              : t('group.finished')}
          </Text>
        </View>
        {canRemove && (
          <Button
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
              accessibilityLabel={t('group.rankRow', {
                rank: entry.rank,
                name,
                count: entry.days,
              })}
              className={cn(
                'min-h-10 flex-row items-center gap-3 border-b border-line',
                entry.userId === me && 'bg-wash',
              )}
            >
              <Text className="w-6 text-right font-mono text-sm text-ink-muted">{entry.rank}</Text>
              <Avatar name={name} size={20} />
              <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
                {name}
              </Text>
              {entry.streak > 1 && (
                <View className="flex-row items-center gap-1">
                  <Icon icon={Flame} tone="ink-muted" />
                  <Text className="font-mono text-xs text-ink-muted">{entry.streak}</Text>
                </View>
              )}
              <Text className="font-mono text-sm text-ink">
                {t('group.days', { count: entry.days })}
              </Text>
            </View>
          );
        })}
      </View>
      {!compact && <Text className="text-xs text-ink-muted">{t('group.rule')}</Text>}
      {removing && (
        <ConfirmDialog
          title={t('group.removeTitle', { name: challenge.name })}
          message={t('group.removeMessage')}
          confirmLabel={t('group.removeChallenge')}
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
