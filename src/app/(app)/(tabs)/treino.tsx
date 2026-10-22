import { ChartColumn, Dumbbell, Folder, Plus, Scale, Users, Zap } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FolderSection, PageRow } from '@/components/folder-cards';
import { useFolderActions } from '@/components/folder-actions';
import { TodayWorkout } from '@/components/gym/week-plan';
import { HubRow, HubSection } from '@/components/hub';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { GymToggle } from '@/components/sidebar-settings';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionLabel } from '@/components/ui/section-label';
import { useProfile } from '@/lib/queries/profile';
import { splitRoots, useTree } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';

// Treino (D258): os treinos, os grupos e as ferramentas de academia num lugar. No celular,
// Biblioteca, Peso e medidas e Estatísticas não tinham caminho (só existiam no bloco Academia da
// barra lateral, que o celular não mostra). Pode ocupar uma posição da barra de baixo.
export default function WorkoutHubScreen() {
  const { t } = useTranslation();
  const tree = useTree();
  const online = useIsOnline();
  const [actions, dialog] = useFolderActions();
  const gymOn = useProfile().data?.gym_enabled === true;
  const { gym, groups } = splitRoots(tree.data, gymOn);

  return (
    <Screen size="medium">
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="gap-6 pb-clear">
        <ScreenHeader
          search
          help="repeticoes-descanso"
          eyebrow={t('workoutHub.eyebrow')}
          title={t('nav.workout')}
        />
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
      </ScreenScroll>
      {dialog}
    </Screen>
  );
}
