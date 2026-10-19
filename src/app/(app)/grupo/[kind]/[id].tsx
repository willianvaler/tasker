import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ChallengesPanel } from '@/components/group/challenges-panel';
import { GroupChat, GroupWall } from '@/components/group/group-feed';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs } from '@/components/ui/tabs';
import { actorCan } from '@/lib/permissions';
import type { Group } from '@/lib/queries/challenges';
import { useFolderActor, useMembers } from '@/lib/queries/projects';
import { teamRoleAtLeast, useTeam } from '@/lib/queries/teams';
import { useTree } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';

type Tab = 'challenges' | 'wall' | 'chat';

/**
 * Treino em grupo (V6 §15.5, AC10.5): desafios com ranking, mural de check-ins e chat de um
 * projeto (/grupo/projeto/<id>) ou de um time (/grupo/time/<id>).
 */
export default function GroupScreen() {
  const { kind, id, desafio } = useLocalSearchParams<{
    kind: string;
    id: string;
    desafio?: string;
  }>();
  const { t } = useTranslation();
  const online = useIsOnline();
  const group: Group = { kind: kind === 'time' ? 'team' : 'project', id };
  const isTeam = group.kind === 'team';

  const tree = useTree();
  const folder = isTeam ? undefined : tree.data?.folders.find((f) => f.id === id);
  const members = useMembers(isTeam ? undefined : id);
  const actor = useFolderActor(isTeam ? undefined : id);
  const team = useTeam(isTeam ? id : '');

  const names = new Map(
    isTeam
      ? (team.data?.members ?? []).map((m) => [m.userId, m.displayName] as const)
      : (members.data ?? []).map((m) => [m.userId, m.displayName] as const),
  );
  const canStart = isTeam
    ? teamRoleAtLeast(team.data?.myRole, 'admin')
    : actorCan(actor, 'page.manage');
  const name = isTeam ? team.data?.name : folder?.name;
  const [tab, setTab] = useState<Tab>('challenges');

  return (
    <Screen size="medium">
      <ScreenHeader back eyebrow={name ?? ''} title={t('group.title')} />
      <Tabs
        label={t('group.title')}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'challenges', label: t('group.challenges') },
          { value: 'wall', label: t('group.wall') },
          { value: 'chat', label: t('group.chat') },
        ]}
      />
      {!online ? (
        <EmptyState title={t('group.offline')} />
      ) : (
        <ScreenScroll
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-6 py-4 pb-clear"
        >
          <View>
            {tab === 'challenges' && (
              <ChallengesPanel group={group} canStart={canStart} focusId={desafio} />
            )}
            {tab === 'wall' && <GroupWall group={group} names={names} />}
            {tab === 'chat' && <GroupChat group={group} names={names} />}
          </View>
        </ScreenScroll>
      )}
    </Screen>
  );
}
