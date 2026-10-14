import { router } from 'expo-router';
import { LayoutTemplate, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { FolderSection } from '@/components/folder-cards';
import { useFolderActions } from '@/components/folder-actions';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { useTree } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';

// Todas as pastas, como linhas (docs/mockups/sidebar.html): cada pasta com as páginas logo abaixo.
export default function FoldersScreen() {
  const { t } = useTranslation();
  const tree = useTree();
  const online = useIsOnline();
  const [actions, dialog] = useFolderActions();
  const folders = tree.data?.folders ?? [];

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
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-6 pb-clear">
        {folders.map((folder) => (
          <FolderSection
            key={folder.id}
            folder={folder}
            onMenu={online ? () => actions.folderMenu(folder) : undefined}
            onNewPage={online ? () => actions.newPage(folder.id) : undefined}
          />
        ))}
        {tree.data && folders.length === 0 && (
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
