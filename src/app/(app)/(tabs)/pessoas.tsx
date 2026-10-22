import { Bell, FolderKanban, Globe, Shield, UserPlus, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { HubRow, HubSection } from '@/components/hub';
import { useUnreadCount } from '@/components/notifications-bell';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { useMyFriends } from '@/lib/queries/friends';
import { useGameState } from '@/lib/queries/game';

// Pessoas (D257): amigos, times, clã, projetos e comunidade num lugar só. Antes eram seis
// caminhos (ícones sem texto no rodapé da barra lateral, botões no Perfil, o globo na tela Pastas).
export default function PeopleScreen() {
  const { t } = useTranslation();
  const friends = useMyFriends().data ?? [];
  const requests = friends.filter((f) => f.incoming).length;
  const accepted = friends.filter((f) => f.status === 'accepted').length;
  const unread = useUnreadCount();
  const { data: game } = useGameState();

  return (
    <Screen size="medium">
      <ScreenScroll contentContainerClassName="gap-6 pb-clear">
        <ScreenHeader search title={t('nav.people')} eyebrow={t('hub.peopleHint')} />
        <HubSection>
          <HubRow
            icon={UserPlus}
            label={t('nav.friends')}
            hint={
              requests ? t('hub.people.requests', { count: requests }) : t('hub.people.friendsHint')
            }
            href="/amigos"
            badge={requests || accepted || null}
          />
          <HubRow
            icon={Users}
            label={t('nav.teams')}
            hint={t('hub.people.teamsHint')}
            href="/teams"
          />
          <HubRow
            icon={FolderKanban}
            label={t('hub.people.projects')}
            hint={t('hub.people.projectsHint')}
            href="/projetos"
          />
          {game?.enabled && (
            <HubRow
              icon={Shield}
              label={t('nav.clan')}
              hint={t('hub.people.clanHint')}
              href="/clan"
            />
          )}
          <HubRow
            icon={Globe}
            label={t('nav.community')}
            hint={t('hub.people.communityHint')}
            href="/comunidade"
          />
          <HubRow
            icon={Bell}
            label={t('nav.notifications')}
            hint={t('hub.people.notificationsHint')}
            href="/notifications"
            badge={unread || null}
          />
        </HubSection>
      </ScreenScroll>
    </Screen>
  );
}
