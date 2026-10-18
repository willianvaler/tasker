import { Redirect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { useChallenge } from '@/lib/queries/challenges';

/** Link do aviso "começou o desafio" (challenge_started): abre o grupo com ele no topo. */
export default function ChallengeLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const challenge = useChallenge(id);
  const c = challenge.data;
  if (c)
    return (
      <Redirect
        href={{
          pathname: '/grupo/[kind]/[id]',
          params: {
            kind: c.team_id ? 'time' : 'projeto',
            id: c.team_id ?? c.folder_id ?? '',
            desafio: c.id,
          },
        }}
      />
    );
  return (
    <Screen size="medium">
      <ScreenHeader back title={t('group.title')} />
      {challenge.isFetched && <EmptyState title={t('group.missing')} />}
    </Screen>
  );
}
