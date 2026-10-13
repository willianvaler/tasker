import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { FolderCard } from '@/components/folder-cards';
import { useFolderActions } from '@/components/folder-actions';
import { Screen } from '@/components/screen';
import { Grid } from '@/components/ui/grid';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useTree } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';

// Todas as pastas em cards (como os Projetos do Claude). Cada card abre a pasta e mostra as páginas.
export default function FoldersScreen() {
  const tree = useTree();
  const online = useIsOnline();
  const [actions, dialog] = useFolderActions();
  const folders = tree.data?.folders ?? [];

  return (
    <Screen size="wide">
      <ScreenHeader
        title="Pastas"
        right={
          <View className="flex-row gap-2">
            <Button
              variant="outline"
              label="Usar modelo"
              disabled={!online}
              onPress={() => router.push('/templates')}
            />
            <Button label="+ Nova pasta" disabled={!online} onPress={() => actions.newFolder()} />
          </View>
        }
      />
      {tree.error && <Text className="text-danger">Erro ao carregar: {tree.error.message}</Text>}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="pb-clear">
        <Grid>
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              onMenu={online ? () => actions.folderMenu(folder) : undefined}
              onNewPage={online ? () => actions.newPage(folder.id) : undefined}
            />
          ))}
        </Grid>
        {tree.data && folders.length === 0 && (
          <View className="mt-12 items-center gap-3">
            <Text className="text-xl">📁</Text>
            <Text className="text-center text-ink-muted">
              Crie pastas para separar os assuntos (Academia, Casa, Trabalho...) e páginas dentro
              delas.
            </Text>
            <Button
              variant="outline"
              label="Criar a primeira pasta"
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
