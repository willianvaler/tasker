import {
  ChartColumn,
  ClipboardList,
  Dumbbell,
  Folder,
  Plus,
  Scale,
  Users,
  Zap,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FolderSection, PageRow } from '@/components/folder-cards';
import { useFolderActions } from '@/components/folder-actions';
import { TodayWorkout } from '@/components/gym/week-plan';
import { HubRow, HubSection } from '@/components/hub';
import { GymToggle } from '@/components/sidebar-settings';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionLabel } from '@/components/ui/section-label';
import { useProfile } from '@/lib/queries/profile';
import { splitRoots, useTree } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';

/**
 * Os treinos, os grupos e as ferramentas de academia (D258): o corpo da tela Treino e, com
 * "Academia dentro do Bem-estar" ligado, a parte Treino do Bem-estar (D270).
 */
export function WorkoutHub() {
  const { t } = useTranslation();
  const tree = useTree();
  const online = useIsOnline();
  const [actions, dialog] = useFolderActions();
  const gymOn = useProfile().data?.gym_enabled === true;
  const { gym, groups } = splitRoots(tree.data, gymOn);

  return (
    <>
      {!gymOn ? (
        <View className="gap-4">
          <EmptyState title={t('workoutHub.off')} hint={t('workoutHub.offHint')} />
          <GymToggle />
        </View>
      ) : (
        <>
          <TodayWorkout />
          <HubSection>
            <HubRow
              icon={Zap}
              label={t('workoutHub.start')}
              hint={t('workoutHub.startHint')}
              href="/modos"
            />
          </HubSection>
          <View>
            <SectionLabel
              title={t('workoutHub.workouts')}
              count={gym?.pages.length || undefined}
              right={
                <Button
                  variant="ghost"
                  icon={Plus}
                  label={t('gym.newWorkout')}
                  disabled={!online}
                  onPress={actions.newWorkout}
                />
              }
            />
            {gym?.pages.map((page) => (
              <PageRow key={page.id} page={page} />
            ))}
            {gym?.children.map((child) => (
              <HubRow
                key={child.id}
                icon={Folder}
                label={child.name}
                href={{ pathname: '/folder/[id]', params: { id: child.id } }}
              />
            ))}
            {tree.data && !gym?.pages.length && (
              <Button
                variant="ghost"
                icon={Plus}
                className="self-start"
                label={t('gym.firstWorkout')}
                disabled={!online}
                onPress={actions.newWorkout}
              />
            )}
            {groups.map((group) => (
              <FolderSection
                key={group.id}
                folder={group}
                onMenu={online ? () => actions.folderMenu(group) : undefined}
                firstLabel={t('gym.firstWorkout')}
                onNewPage={online ? () => actions.newGroupWorkout(group.id) : undefined}
              />
            ))}
            <Button
              variant="ghost"
              icon={Users}
              className="self-start"
              label={t('gym.newGroup')}
              disabled={!online}
              onPress={actions.newGymGroup}
            />
          </View>
          <HubSection title={t('workoutHub.tools')}>
            <HubRow
              icon={ClipboardList}
              label={t('workoutHub.plans')}
              hint={t('plans.hubHint')}
              href="/planos"
            />
            <HubRow
              icon={Dumbbell}
              label={t('library.title')}
              hint={t('workoutHub.libraryHint')}
              href="/biblioteca"
            />
            <HubRow
              icon={Scale}
              label={t('body.title')}
              hint={t('workoutHub.bodyHint')}
              href="/corpo"
            />
            <HubRow
              icon={ChartColumn}
              label={t('stats.title')}
              hint={t('workoutHub.statsHint')}
              href="/treino-estatisticas"
            />
          </HubSection>
        </>
      )}
      {dialog}
    </>
  );
}
