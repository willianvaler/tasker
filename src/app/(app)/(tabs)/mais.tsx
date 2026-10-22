import {
  Bell,
  CalendarDays,
  CalendarRange,
  CircleHelp,
  ClipboardCheck,
  Dumbbell,
  Globe,
  HeartPulse,
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
import { useWindowDimensions, View } from 'react-native';

import { HubRow, HubSection } from '@/components/hub';
import { useUnreadCount } from '@/components/notifications-bell';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { useTabSlots } from '@/components/tab-bar';
import { useMyFriends } from '@/lib/queries/friends';
import { useGameState } from '@/lib/queries/game';
import { useGymInWellness, useProfile } from '@/lib/queries/profile';
import { useTree } from '@/lib/queries/tree';
import { signOutHere } from '@/lib/sign-out';
import type { TabSlot } from '@/lib/tab-slots';
import { useSession } from '@/providers/session';

// Mais (D257, D258): o índice completo do app, como o "Browse" do Todoist. Tudo o que não está na
// barra de baixo fica aqui, com nome e uma dica, a no máximo dois toques de qualquer tela. No
// computador, o cartão do avatar no rodapé da barra lateral abre esta mesma tela.
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
  const gymInWellness = useGymInWellness();
  // No celular, o que já está na barra de baixo não se repete aqui
  const slots = useTabSlots();
  const narrow = useWindowDimensions().width < 768;
  const show = (slot: TabSlot) => !narrow || !slots.includes(slot);

  return (
    <Screen size="medium">
      <ScreenScroll contentContainerClassName="gap-6 pb-clear">
        <ScreenHeader
          search
          help="comecando"
          title={profile?.display_name || t('nav.more')}
          eyebrow={
            profile?.username
              ? `@${profile.username}${game?.enabled ? ` · ${t('nav.level', { level: game.level })}` : ''}`
              : session?.user.email
          }
        />
        <HubSection title={t('hub.goTo')}>
          {show('planejar') && (
            <HubRow
              icon={CalendarRange}
              label={t('nav.plan')}
              hint={t('plan.eyebrow')}
              href="/planejar"
            />
          )}
          {show('inbox') && <HubRow icon={Inbox} label={t('nav.inbox')} href="/inbox" />}
          {show('habits') && <HubRow icon={Repeat} label={t('nav.habits')} href="/habits" />}
          <HubRow
            icon={CalendarDays}
            label={t('nav.calendar')}
            hint={t('plan.calendarHint')}
            href="/calendario"
          />
          <HubRow
            icon={ClipboardCheck}
            label={t('review.title')}
            hint={t('plan.reviewHint')}
            href="/revisao"
          />
          {inProject && (
            <HubRow icon={UserCheck} label={t('nav.mine')} hint={t('plan.mineHint')} href="/mine" />
          )}
        </HubSection>
        <HubSection title={t('hub.spaces')}>
          {show('folders') && (
            <HubRow
              icon={LayoutGrid}
              label={t('nav.folders')}
              hint={t('hub.foldersHint')}
              href="/folders"
            />
          )}
          {show('bem-estar') && (
            <HubRow
              icon={HeartPulse}
              label={t('nav.wellness')}
              hint={t('wellness.eyebrow')}
              href="/bem-estar"
            />
          )}
          {gymOn && !gymInWellness && show('treino') && (
            <HubRow
              icon={Dumbbell}
              label={t('nav.workout')}
              hint={t('workoutHub.eyebrow')}
              href="/treino"
            />
          )}
          <HubRow
            icon={NotebookPen}
            label={t('notes.title')}
            hint={t('hub.notesHint')}
            href="/notas"
          />
          <HubRow
            icon={LayoutTemplate}
            label={t('folder.useTemplate')}
            hint={t('hub.templatesHint')}
            href="/templates"
          />
        </HubSection>
        <HubSection title={t('hub.you')}>
          {show('pessoas') && (
            <HubRow
              icon={Users}
              label={t('nav.people')}
              hint={t('hub.peopleHint')}
              href="/pessoas"
              badge={requests || null}
            />
          )}
          {game?.enabled && show('jogo') && (
            <HubRow icon={Swords} label={t('nav.game')} hint={t('hub.gameHint')} href="/jogo" />
          )}
          <HubRow
            icon={Bell}
            label={t('nav.notifications')}
            hint={t('hub.people.notificationsHint')}
            href="/notifications"
            badge={unread || null}
          />
          <HubRow
            icon={Zap}
            label={t('modes.title')}
            hint={t('workoutHub.startHint')}
            href="/modos"
          />
          <HubRow
            icon={Globe}
            label={t('nav.community')}
            hint={t('hub.people.communityHint')}
            href="/comunidade"
          />
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
