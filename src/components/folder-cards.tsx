import type { TFunction } from 'i18next';
import { Link } from 'expo-router';
import { MoreHorizontal, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ItemIcon, type ItemKind } from '@/components/item-icon';
import { resetCycleLabel } from '@/components/page-dialog';
import { IconButton } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { pageLabel, type FolderNode, type Page, type SubFolder } from '@/lib/queries/tree';

/** Nome da pasta para texto (o ícone é desenhado à parte, pelo components/item-icon.tsx). */
export function folderLabel(folder: { name: string }) {
  return folder.name;
}

/** "3 páginas · 1 subpasta" */
export function folderSummary(folder: FolderNode | SubFolder, t: TFunction) {
  const pages = folder.pages.length + ('children' in folder ? sum(folder.children) : 0);
  const subs = 'children' in folder ? folder.children.length : 0;
  const project = 'kind' in folder && folder.kind === 'project';
  const parts = [t(project ? 'project.item.count' : 'folder.pages', { count: pages })];
  if (subs) parts.push(t('folder.subfolders', { count: subs }));
  return parts.join(' · ');
}

const sum = (children: SubFolder[]) => children.reduce((n, c) => n + c.pages.length, 0);

/** Botão de opções (⋯) com alvo de 44 px no celular e 32 no computador. */
export function MenuButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <IconButton icon={MoreHorizontal} label={t('nav.options', { name: label })} onPress={onPress} />
  );
}

/**
 * Pasta na aba Pastas: uma linha com o marcador de cor, o ícone e o
 * resumo em mono, e as páginas logo abaixo, para chegar a qualquer uma em 2 toques.
 * Linhas, não cartões.
 */
export function FolderSection({
  folder,
  onMenu,
  onNewPage,
  firstLabel,
}: {
  folder: FolderNode;
  onMenu?: () => void;
  onNewPage?: () => void;
  /** Texto do convite da pasta vazia (na Academia: "Criar o primeiro treino", como na barra lateral) */
  firstLabel?: string;
}) {
  const { t } = useTranslation();
  const empty = folder.pages.length === 0 && folder.children.length === 0;
  return (
    <View>
      <View className="min-h-12 flex-row items-center gap-2 border-b border-line">
        <Link href={{ pathname: '/folder/[id]', params: { id: folder.id } }} asChild>
          <Pressable
            accessibilityRole="link"
            className="min-h-12 flex-1 flex-row items-center gap-3 rounded px-2 hover:bg-wash"
          >
            {folder.color && (
              <View className="h-5 w-1 rounded" style={{ backgroundColor: folder.color }} />
            )}
            <ItemIcon
              icon={folder.icon}
              kind={folder.kind === 'project' ? 'project' : 'folder'}
              size={20}
              tone="ink"
            />
            <Text className="flex-1 font-serif text-lg text-ink" numberOfLines={1}>
              {folder.name}
            </Text>
            <Text className="font-mono text-xs text-ink-muted">
              {folder.kind === 'project' ? `${t('folder.project')} · ` : ''}
              {folderSummary(folder, t)}
            </Text>
          </Pressable>
        </Link>
        {onMenu && <MenuButton label={folder.name} onPress={onMenu} />}
      </View>
      {folder.pages.map((page) => (
        <PageRow key={page.id} page={page} indent />
      ))}
      {folder.children.map((child) => (
        <Link key={child.id} href={{ pathname: '/folder/[id]', params: { id: child.id } }} asChild>
          <Pressable
            accessibilityRole="link"
            className="min-h-11 flex-row items-center gap-3 border-b border-line pl-8 pr-2 hover:bg-wash md:min-h-10"
          >
            <ItemIcon icon={child.icon} kind="folder" />
            <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
              {child.name}
            </Text>
            <Text className="font-mono text-xs text-ink-muted">{folderSummary(child, t)}</Text>
          </Pressable>
        </Link>
      ))}
      {empty && onNewPage && (
        <Pressable
          accessibilityRole="button"
          className="min-h-11 flex-row items-center gap-3 pl-8 pr-2 hover:bg-wash md:min-h-10"
          onPress={onNewPage}
        >
          <Icon icon={Plus} tone="accent" />
          <Text className="text-sm text-ink">{firstLabel ?? t('folder.firstPage')}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Página numa lista: ícone do tipo, nome e, em mono, o tipo e o reinício. */
export function PageRow({
  page,
  onMenu,
  indent,
}: {
  page: Page;
  onMenu?: () => void;
  indent?: boolean;
}) {
  const { t } = useTranslation();
  const label = pageLabel(page);
  const reset = resetCycleLabel(page.reset_cycle, t);
  const type = t(`pageDialog.${(page.view_type as 'list') ?? 'list'}`);
  return (
    <View className="flex-row items-center border-b border-line">
      <Link href={{ pathname: '/page/[id]', params: { id: page.id } }} asChild>
        <Pressable
          accessibilityRole="link"
          className={
            indent
              ? 'min-h-11 flex-1 flex-row items-center gap-3 pl-8 pr-2 hover:bg-wash md:min-h-10'
              : 'min-h-11 flex-1 flex-row items-center gap-3 px-2 hover:bg-wash md:min-h-10'
          }
        >
          <ItemIcon icon={page.icon} kind={page.view_type as ItemKind} />
          <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
            {label}
          </Text>
          <Text className="font-mono text-xs text-ink-muted" numberOfLines={1}>
            {reset ? `${type} · ${reset.toLowerCase()}` : type}
          </Text>
        </Pressable>
      </Link>
      {onMenu && <MenuButton label={label} onPress={onMenu} />}
    </View>
  );
}
