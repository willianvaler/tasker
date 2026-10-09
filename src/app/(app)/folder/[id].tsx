import { Link, router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useFolderActions } from '@/components/folder-actions';
import { folderLabel, folderSummary, MenuButton, PageTile } from '@/components/folder-cards';
import { ProjectOverview } from '@/components/project-overview';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { findFolder, useTree } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';
import { useCanWrite } from '@/providers/write';

// Visão geral da pasta (como a página de um projeto no Claude): páginas e subpastas.
export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tree = useTree();
  const online = useIsOnline();
  const [actions, dialog] = useFolderActions();
  const found = findFolder(tree.data, id);
  // Leitor do projeto só vê (e comenta nas tarefas)
  const writable = useCanWrite(id);

  if (tree.data && !found) {
    return (
      <Screen>
        <ScreenHeader title="Pasta" back />
        <Text className="mt-6 text-muted-foreground">Essa pasta não existe mais.</Text>
      </Screen>
    );
  }

  const folder = found?.folder;
  const children = folder && 'children' in folder ? folder.children : [];
  const empty = !!folder && folder.pages.length === 0 && children.length === 0;

  return (
    <Screen>
      <ScreenHeader
        title={folder ? folderLabel(folder) : ''}
        back
        right={
          folder && online ? (
            <MenuButton label={folderLabel(folder)} onPress={() => actions.folderMenu(folder)} />
          ) : null
        }
      />
      {found?.parent && (
        <Link href={{ pathname: '/folder/[id]', params: { id: found.parent.id } }} asChild>
          <Pressable accessibilityRole="link" className="-mt-2 mb-2 self-start">
            <Text className="text-sm text-muted-foreground">em {folderLabel(found.parent)}</Text>
          </Pressable>
        </Link>
      )}
      {folder && (
        <View className="mb-3 flex-row flex-wrap items-center gap-2">
          <Text className="flex-1 text-sm text-muted-foreground">
            {folder.is_shared ? '👥 Projeto · ' : ''}
            {folderSummary(folder)}
          </Text>
          {!folder.parent_id && (
            <Button
              variant="outline"
              label={folder.is_shared ? '👥 Pessoas' : '👥 Compartilhar'}
              disabled={!online}
              onPress={() => router.push({ pathname: '/share/[id]', params: { id: folder.id } })}
            />
          )}
          {!folder.parent_id && writable && (
            <Button
              variant="outline"
              label="+ Subpasta"
              onPress={() => actions.newFolder(folder.id)}
            />
          )}
          {writable && <Button label="+ Nova página" onPress={() => actions.newPage(folder.id)} />}
        </View>
      )}

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-2 pb-28">
        {folder && 'children' in folder && folder.is_shared && (
          <View className="mb-2">
            <ProjectOverview root={folder} />
          </View>
        )}
        {folder?.pages.map((page) => (
          <PageTile
            key={page.id}
            page={page}
            onMenu={writable ? () => actions.pageMenu(page) : undefined}
          />
        ))}
        {empty && (
          <View className="mt-8 items-center gap-2">
            <Text className="text-center text-muted-foreground">
              Uma pasta guarda páginas: uma lista de compras, um treino em cards, seus hábitos.
            </Text>
            {writable && folder && (
              <Pressable
                accessibilityRole="button"
                className="min-h-11 justify-center px-3"
                onPress={() => actions.newPage(folder.id)}
              >
                <Text className="text-base text-primary">+ Criar a primeira página</Text>
              </Pressable>
            )}
          </View>
        )}
        {children.map((child) => (
          <View key={child.id} className="mt-4 gap-2">
            <View className="flex-row items-center">
              <Link href={{ pathname: '/folder/[id]', params: { id: child.id } }} asChild>
                <Pressable accessibilityRole="link" className="min-h-11 flex-1 justify-center">
                  <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                    {folderLabel(child)}
                  </Text>
                </Pressable>
              </Link>
              {online && (
                <MenuButton label={folderLabel(child)} onPress={() => actions.folderMenu(child)} />
              )}
            </View>
            {child.pages.map((page) => (
              <PageTile
                key={page.id}
                page={page}
                onMenu={writable ? () => actions.pageMenu(page) : undefined}
              />
            ))}
            {child.pages.length === 0 && online && (
              <Pressable
                accessibilityRole="button"
                className="min-h-11 justify-center"
                onPress={() => actions.newPage(child.id)}
              >
                <Text className="text-sm text-primary">+ Nova página em {child.name}</Text>
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>
      {dialog}
    </Screen>
  );
}
