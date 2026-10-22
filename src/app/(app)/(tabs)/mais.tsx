import {
  Bell,
  CalendarDays,
  CircleHelp,
  ClipboardCheck,
  Dumbbell,
  Globe,
  Inbox,
  LayoutGrid,
  LayoutTemplate,
  LogOut,
  NotebookPen,
  RefreshCw,
  Repeat,
  Settings,
  Swords,
  Trash2,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { HubRow, HubSection } from '@/components/hub';
import { useUnreadCount } from '@/components/notifications-bell';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { useMyFriends } from '@/lib/queries/friends';
import { useGameState } from '@/lib/queries/game';
import { useProfile } from '@/lib/queries/profile';
import { useTree } from '@/lib/queries/tree';
import { signOutHere } from '@/lib/sign-out';
import { useSession } from '@/providers/session';

// Mais (D257): o índice completo do app, como o "Browse" do Todoist. Tudo o que não está na barra
// de baixo fica aqui, com nome e uma dica, a no máximo dois toques de qualquer tela. No computador,
// o cartão do avatar no rodapé da barra lateral abre esta mesma tela.
export default function MoreScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const profile = useProfile().data;
  const tree = useTree();
  const { data: game } = useGameState();
  const unread = useUnreadCount();
  const requests = (useMyFriends().data ?? []).filter((f) => f.incoming).length;
  const inProject = !!tree.data?.folders.some((f) => f.is_shared);
  const gymOn = profile?.gym_enabled === true;

  return (
    <Screen size="medium">
      <ScreenScroll contentContainerClassName="gap-6 pb-clear">
        <ScreenHeader
          help="comecando"
          title={profile?.display_name || t('nav.more')}
          eyebrow={
            profile?.username
              ? `@${profile.username}${game?.enabled ? ` · ${t('nav.level', { level: game.level })}` : ''}`
              : session?.user.email
          }
        />
        <HubSection title={t('hub.goTo')}>
          <HubRow icon={Inbox} label={t('nav.inbox')} href="/inbox" />
          <HubRow icon={Repeat} label={t('nav.habits')} href="/habits" />
          <HubRow icon={CalendarDays} label={t('nav.calendar')} href="/calendario" />
          <HubRow icon={ClipboardCheck} label={t('review.title')} href="/revisao" />
          {inProject && <HubRow icon={UserCheck} label={t('nav.mine')} href="/mine" />}
          <HubRow
            icon={NotebookPen}
            label={t('notes.title')}
            hint={t('hub.notesHint')}
            href="/notas"
          />
        </HubSection>
        <HubSection title={t('hub.spaces')}>
          <HubRow
            icon={LayoutGrid}
            label={t('nav.folders')}
            hint={t('hub.foldersHint')}
            href="/folders"
          />
          {gymOn && (
            <HubRow icon={Dumbbell} label={t('gym.block')} hint={t('gym.toggleHint')} href="/folders" />
          )}
          <HubRow
            icon={LayoutTemplate}
            label={t('folder.useTemplate')}
            hint={t('hub.templatesHint')}
            href="/templates"
          />
          <HubRow
            icon={Globe}
            label={t('nav.community')}
            hint={t('hub.people.communityHint')}
            href="/comunidade"
          />
        </HubSection>
        <HubSection title={t('hub.you')}>
          <HubRow
            icon={Users}
            label={t('nav.people')}
            hint={t('hub.peopleHint')}
            href="/pessoas"
            badge={requests || null}
          />
          {game?.enabled && (
            <HubRow icon={Swords} label={t('nav.game')} hint={t('hub.gameHint')} href="/jogo" />
          )}
          <HubRow icon={Bell} label={t('nav.notifications')} href="/notifications" badge={unread || null} />
          <HubRow icon={Zap} label={t('modes.title')} href="/modos" />
        </HubSection>
        <HubSection title={t('hub.app')}>
          <HubRow
            icon={Settings}
            label={t('nav.settings')}
            hint={t('hub.settingsHint')}
            href="/configuracoes"
          />
          <HubRow icon={CircleHelp} label={t('help.link')} hint={t('hub.helpHint')} href="/ajuda" />
          <HubRow icon={Trash2} label={t('trash.link')} hint={t('hub.trashHint')} href="/lixeira" />
          <HubRow icon={RefreshCw} label={t('sync.title')} hint={t('hub.syncHint')} href="/sync" />
          <View className="pt-4">
            <HubRow icon={LogOut} label={t('hub.signOut')} tone="danger" onPress={signOutHere} />
          </View>
        </HubSection>
      </ScreenScroll>
    </Screen>
  );
}
