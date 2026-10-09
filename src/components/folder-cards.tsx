import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { pageLabel, type FolderNode, type Page, type SubFolder } from '@/lib/queries/tree';

const VIEW_LABEL: Record<string, string> = {
  list: 'Lista',
  cards: 'Cards',
  habits: 'Hábitos',
  kanban: 'Kanban',
};
const RESET_LABEL: Record<string, string> = {
  daily: 'reinicia todo dia',
  weekly: 'reinicia toda segunda',
  manual: 'reinício manual',
};

export function folderLabel(folder: { icon: string | null; name: string }) {
  return `${folder.icon || '📁'} ${folder.name}`;
}

/** "3 páginas · 1 subpasta" */
export function folderSummary(folder: FolderNode | SubFolder) {
  const pages = folder.pages.length + ('children' in folder ? sum(folder.children) : 0);
  const subs = 'children' in folder ? folder.children.length : 0;
  const parts = [pages === 1 ? '1 página' : `${pages} páginas`];
  if (subs) parts.push(subs === 1 ? '1 subpasta' : `${subs} subpastas`);
  return parts.join(' · ');
}

const sum = (children: SubFolder[]) => children.reduce((n, c) => n + c.pages.length, 0);

/** Botão "⋯" de opções (alvo de 44px). */
export function MenuButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Opções de ${label}`}
      className="h-11 w-11 items-center justify-center rounded-full active:bg-muted"
      onPress={onPress}
    >
      <Text className="text-lg text-muted-foreground">⋯</Text>
    </Pressable>
  );
}

/**
 * Card de pasta na aba Pastas: o topo abre a pasta, e as páginas aparecem logo abaixo para
 * chegar a qualquer uma em 2 toques (ESCOPO 5).
 */
export function FolderCard({
  folder,
  onMenu,
  onNewPage,
}: {
  folder: FolderNode;
  onMenu?: () => void;
  onNewPage?: () => void;
}) {
  const label = folderLabel(folder);
  const empty = folder.pages.length === 0 && folder.children.length === 0;
  return (
    <View className="gap-1 rounded-2xl border border-border bg-card p-3">
      <View className="flex-row items-center">
        <Link href={{ pathname: '/folder/[id]', params: { id: folder.id } }} asChild>
          <Pressable accessibilityRole="link" className="min-h-11 flex-1 justify-center">
            <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
              {label}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {folder.is_shared ? '👥 Projeto · ' : ''}
              {folderSummary(folder)}
            </Text>
          </Pressable>
        </Link>
        {onMenu && <MenuButton label={label} onPress={onMenu} />}
      </View>
      {folder.pages.map((page) => (
        <PageLink key={page.id} page={page} />
      ))}
      {folder.children.map((child) => (
        <Link key={child.id} href={{ pathname: '/folder/[id]', params: { id: child.id } }} asChild>
          <Pressable
            accessibilityRole="link"
            className="min-h-11 flex-row items-center rounded-lg px-2 active:bg-muted"
          >
            <Text className="flex-1 text-base text-foreground" numberOfLines={1}>
              {folderLabel(child)}
            </Text>
            <Text className="text-xs text-muted-foreground">{folderSummary(child)}</Text>
          </Pressable>
        </Link>
      ))}
      {empty && onNewPage && (
        <Pressable
          accessibilityRole="button"
          className="min-h-11 justify-center rounded-lg px-2 active:bg-muted"
          onPress={onNewPage}
        >
          <Text className="text-sm text-primary">+ Criar a primeira página</Text>
        </Pressable>
      )}
    </View>
  );
}

function PageLink({ page }: { page: Page }) {
  return (
    <Link href={{ pathname: '/page/[id]', params: { id: page.id } }} asChild>
      <Pressable
        accessibilityRole="link"
        className="min-h-11 justify-center rounded-lg px-2 active:bg-muted"
      >
        <Text className="text-base text-foreground" numberOfLines={1}>
          {pageLabel(page)}
        </Text>
      </Pressable>
    </Link>
  );
}

/** Página na tela da pasta: nome, tipo e reinício. */
export function PageTile({ page, onMenu }: { page: Page; onMenu?: () => void }) {
  const label = pageLabel(page);
  const reset = RESET_LABEL[page.reset_cycle];
  return (
    <View className="flex-row items-center rounded-xl border border-border bg-card pl-3">
      <Link href={{ pathname: '/page/[id]', params: { id: page.id } }} asChild>
        <Pressable accessibilityRole="link" className="min-h-14 flex-1 justify-center py-2">
          <Text className="text-base font-medium text-foreground" numberOfLines={1}>
            {label}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {VIEW_LABEL[page.view_type] ?? 'Lista'}
            {reset ? ` · ${reset}` : ''}
          </Text>
        </Pressable>
      </Link>
      {onMenu && <MenuButton label={label} onPress={onMenu} />}
    </View>
  );
}
