import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ChallengePeople } from '@/components/group/challenge-people';
import { ChallengeCard } from '@/components/group/challenges-panel';
import { GroupChat, GroupWall } from '@/components/group/group-feed';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { useChallenge, useChallengeBoard } from '@/lib/queries/challenges';
import { useIsOnline } from '@/providers/online';
import { useSession } from '@/providers/session';

type Tab = 'ranking' | 'wall' | 'chat' | 'people';

/**
 * Desafio (AC15C, estilo GymRats): o próprio grupo. Ranking pelo critério escolhido, mural de
 * check-ins, chat e as pessoas, com o código para entrar. Também é o link dos avisos
 * (challenge_started, challenge_finished).
 */
export default function ChallengeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const online = useIsOnline();
  const me = useSession().session?.user.id;
  const challenge = useChallenge(id);
  const board = useChallengeBoard(challenge.data ? id : undefined);
  const [tab, setTab] = useState<Tab>('ranking');
  const c = challenge.data;
  const rows = board.data ?? [];
  const names = new Map(rows.map((r) => [r.user_id, r.display_name] as const));

  return (
    <Screen size="medium">
      <ScreenHeader
        back
        help="repeticoes-descanso"
        eyebrow={t('challenge.eyebrow')}
        title={c?.name ?? t('challenge.eyebrow')}
      />
      {!online ? (
        <EmptyState title={t('challenge.offline')} />
      ) : challenge.isFetched && !c ? (
        <EmptyState title={t('group.missing')} />
      ) : c ? (
        <>
          <Tabs
            label={t('challenge.tabs')}
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'ranking', label: t('challenge.ranking') },
              { value: 'wall', label: t('group.wall') },
              { value: 'chat', label: t('group.chat') },
              { value: 'people', label: t('challenge.people') },
            ]}
          />
          <ScreenScroll
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="gap-6 py-4 pb-clear"
          >
            <View>
              {tab === 'ranking' && (
                <View className="gap-3">
                  <Text className="font-mono text-xs text-ink-muted">
                    {t(`challenge.scoring.${c.scoring}`)} ·{' '}
                    {t('challenge.members', { count: rows.length })}
                  </Text>
                  <ChallengeCard challenge={c} canRemove={false} bare />
                </View>
              )}
              {tab === 'wall' && (
                <GroupWall group={{ kind: 'challenge', id: c.id }} names={names} />
              )}
              {tab === 'chat' && (
                <GroupChat group={{ kind: 'challenge', id: c.id }} names={names} />
              )}
              {tab === 'people' && me && <ChallengePeople challenge={c} rows={rows} />}
            </View>
          </ScreenScroll>
        </>
      ) : null}
    </Screen>
  );
}
