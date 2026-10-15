import { router } from 'expo-router';
import { LayoutTemplate, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { FolderSection, PageRow } from '@/components/folder-cards';
import { useFolderActions } from '@/components/folder-actions';
import { PendingShares } from '@/components/received';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button, IconButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { usePendingShares, useReceivedPages } from '@/lib/queries/shares';
import { useTree } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';

// Todas as pastas, como linhas: cada pasta com as páginas logo abaixo.
export default function FoldersScreen() {
  const { t } = useTranslation();
  const tree = useTree();
  const online = useIsOnline();
  const [actions, dialog] = useFolderActions();
  const folders = tree.data?.folders ?? [];
  const personal = folders.filter((f) => f.kind !== 'project');
  const projects = folders.filter((f) => f.kind === 'project');
  const received = useReceivedPages();
  const pending = usePendingShares();

  return (
    <Screen size="medium">
      <ScreenHeader
        title={t('folder.title')}
        right={
          <>
            <Button
              variant="ghost"
              icon={LayoutTemplate}
              label={t('folder.useTemplate')}
              disabled={!online}
              onPress={() => router.push('/templates')}
            />
            <Button
              icon={Plus}
              label={t('folder.newFolder')}
              disabled={!online}
              onPress={() => actions.newFolder()}
            />
          </>
        }
      />
      {tree.error && (
        <Text className="text-sm text-danger">
          {t('common.loadError', { message: tree.error.message })}
        </Text>
      )}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-12 pb-clear">
        {[
          {
            kind: 'folder',
            title: t('folder.title'),
            list: personal,
            add: () => actions.newFolder(),
          },
          {
            kind: 'project',
            title: t('folder.projects'),
            list: projects,
            add: () => actions.newProject(),
          },
        ].map((section) =>
          section.list.length === 0 ? null : (
            <View key={section.kind} className="gap-6">
              <SectionLabel
                title={section.title}
                count={section.list.length}
                className="pt-0"
                right={
                  <IconButton
                    icon={Plus}
                    label={t(section.kind === 'project' ? 'folder.newProject' : 'folder.newFolder')}
                    disabled={!online}
                    onPress={section.add}
                  />
                }
              />
              {section.list.map((folder) => (
                <FolderSection
                  key={folder.id}
                  folder={folder}
                  onMenu={online ? () => actions.folderMenu(folder) : undefined}
                  onNewPage={online ? () => actions.newPage(folder.id) : undefined}
                />
              ))}
            </View>
          ),
        )}
        {((received.data?.length ?? 0) > 0 || (pending.data?.length ?? 0) > 0) && (
          // Páginas que outras pessoas me enviaram (L4)
          <View className="gap-3">
            <SectionLabel
              title={t('received.title')}
              count={received.data?.length}
              className="pt-0"
            />
            {(received.data ?? []).map((page) => (
              <PageRow key={page.id} page={page} />
            ))}
            <PendingShares />
          </View>
        )}
        {tree.data && folders.length === 0 && !received.data?.length && (
          <View className="items-center">
            <EmptyState title={t('folder.emptyFolders')} />
            <Button
              variant="ghost"
              icon={Plus}
              label={t('folder.firstFolder')}
              disabled={!online}
              onPress={() => actions.newFolder()}
            />
          </View>
        )}
      </ScrollView>
      {dialog}
    </Screen>
  );
}
