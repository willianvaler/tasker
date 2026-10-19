import { router } from 'expo-router';
import { Bot, MoreHorizontal, Plus, Users, UsersRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useFolderActions } from '@/components/folder-actions';
import { ItemIcon } from '@/components/item-icon';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button, IconButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { useTree } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';

// Configurações de projetos (W2): um lugar para os projetos e os times. Cada projeto com o que se
// configura nele (pessoas e convites, automações, renomear, salvar como modelo, apagar) e os
// times logo abaixo. Antes, Times ficava no bloco do jogo do Perfil.
export default function ProjectsSettingsScreen() {
  const { t } = useTranslation();
  const online = useIsOnline();
  const tree = useTree();
  const [actions, dialog] = useFolderActions();
  const projects = (tree.data?.folders ?? []).filter((f) => f.kind === 'project');

  return (
    <Screen>
      <ScreenScroll contentContainerClassName="gap-6 pb-clear">
        <ScreenHeader help="pastas-projetos-paginas" title={t('projectsHub.title')} back />
        <Text className="text-sm text-ink-muted">{t('projectsHub.hint')}</Text>
        <View className="gap-1">
          <SectionLabel
            title={t('nav.projects')}
            count={projects.length}
            right={
              <IconButton
                icon={Plus}
                label={t('nav.newProjectHere')}
                disabled={!online}
                onPress={() => actions.newProject()}
              />
            }
          />
          {tree.data && projects.length === 0 && <EmptyState title={t('projectsHub.empty')} />}
          {projects.map((project) => (
            <View key={project.id} className="gap-1 border-b border-line py-2">
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t('projectsHub.open', { name: project.name })}
                onPress={() =>
                  router.push({ pathname: '/folder/[id]', params: { id: project.id } })
                }
                className="min-h-10 flex-row items-center gap-2 rounded px-1 hover:bg-wash"
              >
                <ItemIcon icon={project.icon} kind="project" />
                <Text className="flex-1 text-base font-semibold text-ink" numberOfLines={1}>
                  {project.name}
                </Text>
              </Pressable>
              <View className="flex-row flex-wrap gap-1">
                <Button
                  variant="ghost"
                  icon={Users}
                  label={t('projectsHub.people')}
                  onPress={() =>
                    router.push({ pathname: '/share/[id]', params: { id: project.id } })
                  }
                />
                <Button
                  variant="ghost"
                  icon={Bot}
                  label={t('auto.title')}
                  onPress={() =>
                    router.push({ pathname: '/automacoes/[id]', params: { id: project.id } })
                  }
                />
                <Button
                  variant="ghost"
                  icon={MoreHorizontal}
                  label={t('projectsHub.more')}
                  disabled={!online}
                  onPress={() => actions.folderMenu(project)}
                />
              </View>
            </View>
          ))}
        </View>

        <View className="gap-2">
          <SectionLabel title={t('nav.teams')} />
          <Text className="text-sm text-ink-muted">{t('projectsHub.teamsHint')}</Text>
          <Button
            variant="ghost"
            icon={UsersRound}
            label={t('projectsHub.openTeams')}
            className="self-start"
            onPress={() => router.push('/teams')}
          />
        </View>
      </ScreenScroll>
      {dialog}
    </Screen>
  );
}
