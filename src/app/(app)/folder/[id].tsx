import { Link, router, useLocalSearchParams } from 'expo-router';
import { ArrowUpRight as ItemArrow, FolderPlus, Plus, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { useFolderActions } from '@/components/folder-actions';
import { folderSummary, MenuButton, PageRow } from '@/components/folder-cards';
import { ItemIcon } from '@/components/item-icon';
import { ProjectOverview } from '@/components/project-overview';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { findFolder, useTree, useTreeMutations } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';
import { useCanWrite } from '@/providers/write';

// Pasta ou projeto: páginas em linhas, subpastas como seções e, no projeto, o progresso e a atividade.
export default function FolderScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tree = useTree();
  const treeMutations = useTreeMutations();
  const online = useIsOnline();
  const [actions, dialog] = useFolderActions();
  const found = findFolder(tree.data, id);
  // Leitor do projeto só vê (e comenta nas tarefas)
  const writable = useCanWrite(id);

  if (tree.data && !found) {
    return (
      <Screen>
        <ScreenHeader title={t('folder.fallbackTitle')} back />
        <EmptyState title={t('folder.missing')} />
      </Screen>
    );
  }

  const folder = found?.folder;
  const children = folder && 'children' in folder ? folder.children : [];
  const empty = !!folder && folder.pages.length === 0 && children.length === 0;
  const project = !!folder && 'children' in folder && folder.kind === 'project';
  const eyebrow = folder
    ? [
        found?.parent ? t('folder.in', { name: found.parent.name }) : null,
        project ? t('folder.project') : null,
        folderSummary(folder, t),
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <Screen size="medium">
      <ScreenHeader
        title={folder?.name ?? ''}
        eyebrow={eyebrow}
        icon={
          folder ? (
            <ItemIcon icon={folder.icon} kind={project ? 'project' : 'folder'} size={20} />
          ) : null
        }
        back
        rename={
          folder && online && writable
            ? {
                target: { kind: 'folder', id: folder.id },
                icon: folder.icon,
                iconKind: project ? 'project' : 'folder',
                color: folder.color,
                onSave: ({ name, icon, color }) =>
                  treeMutations.updateFolder.mutate({ id: folder.id, name, icon, color }),
              }
            : undefined
        }
        right={
          folder && online ? (
            <MenuButton label={folder.name} onPress={() => actions.folderMenu(folder)} />
          ) : null
        }
      />
      {folder && (
        <View className="flex-row flex-wrap items-center gap-2 pb-2">
          {!folder.parent_id && (
            <Button
              variant="ghost"
              icon={Users}
              label={folder.is_shared ? t('folder.people') : t('folder.share')}
              disabled={!online}
              onPress={() => router.push({ pathname: '/share/[id]', params: { id: folder.id } })}
            />
          )}
          {!folder.parent_id && writable && (
            <Button
              variant="ghost"
              icon={FolderPlus}
              label={t('folder.subfolder')}
              onPress={() => actions.newFolder(folder.id)}
            />
          )}
          {writable && (
            <Button
              icon={Plus}
              label={t('folder.newPage')}
              className="ml-auto"
              onPress={() => actions.newPage(folder.id)}
            />
          )}
        </View>
      )}

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="pb-clear">
        {folder && 'children' in folder && project && (
          <View className="mb-4">
            <ProjectOverview root={folder} />
          </View>
        )}
        <View className="border-t border-line">
          {folder?.pages.map((page) => (
            <PageRow
              key={page.id}
              page={page}
              onMenu={writable ? () => actions.pageMenu(page) : undefined}
            />
          ))}
        </View>
        {empty && (
          <View className="items-center">
            <EmptyState title={t('folder.emptyFolder')} />
            {writable && folder && (
              <Button
                variant="ghost"
                icon={Plus}
                label={t('folder.firstPage')}
                onPress={() => actions.newPage(folder.id)}
              />
            )}
          </View>
        )}
        {children.map((child) => (
          <View key={child.id}>
            <SectionLabel
              title={child.name}
              count={child.pages.length}
              right={
                <View className="flex-row items-center">
                  <Link href={{ pathname: '/folder/[id]', params: { id: child.id } }} asChild>
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={child.name}
                      className="h-8 justify-center px-2"
                    >
                      <Icon icon={ItemArrow} tone="ink-muted" />
                    </Pressable>
                  </Link>
                  {online && (
                    <MenuButton label={child.name} onPress={() => actions.folderMenu(child)} />
                  )}
                </View>
              }
            />
            {child.pages.map((page) => (
              <PageRow
                key={page.id}
                page={page}
                onMenu={writable ? () => actions.pageMenu(page) : undefined}
              />
            ))}
            {child.pages.length === 0 && online && (
              <Pressable
                accessibilityRole="button"
                className="min-h-11 flex-row items-center gap-3 hover:bg-wash md:min-h-10"
                onPress={() => actions.newPage(child.id)}
              >
                <Icon icon={Plus} tone="accent" />
                <Text className="text-sm text-ink">
                  {t('folder.newPageIn', { name: child.name })}
                </Text>
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>
      {dialog}
    </Screen>
  );
}
