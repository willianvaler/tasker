import { router } from 'expo-router';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { FolderCard } from '@/components/folder-cards';
import { useFolderActions } from '@/components/folder-actions';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { useTree } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';

// Todas as pastas em cards (como os Projetos do Claude). Cada card abre a pasta e mostra as páginas.
export default function FoldersScreen() {
  const tree = useTree();
  const online = useIsOnline();
  const [actions, dialog] = useFolderActions();
  const twoColumns = useWindowDimensions().width >= 640;
  const folders = tree.data?.folders ?? [];

  return (
    <Screen>
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
      {tree.error && (
        <Text className="text-destructive">Erro ao carregar: {tree.error.message}</Text>
      )}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="pb-28">
        <View className="flex-row flex-wrap gap-3">
          {folders.map((folder) => (
            <View key={folder.id} style={{ flexBasis: twoColumns ? '40%' : '100%', flexGrow: 1 }}>
              <FolderCard
                folder={folder}
                onMenu={online ? () => actions.folderMenu(folder) : undefined}
                onNewPage={online ? () => actions.newPage(folder.id) : undefined}
              />
            </View>
          ))}
          {/* Com número ímpar de pastas, o último card não estica até a largura toda */}
          {twoColumns && folders.length % 2 === 1 && (
            <View style={{ flexBasis: '40%', flexGrow: 1 }} />
          )}
        </View>
        {tree.data && folders.length === 0 && (
          <View className="mt-10 items-center gap-3">
            <Text className="text-4xl">📁</Text>
            <Text className="text-center text-muted-foreground">
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
