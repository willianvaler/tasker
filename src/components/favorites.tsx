import { router, usePathname } from 'expo-router';
import { FileText, Search, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useCommandPalette } from '@/components/command-palette';
import { ItemIcon, type ItemKind } from '@/components/item-icon';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import {
  favoriteKey,
  isFavorite,
  liveFavorites,
  readFavorites,
  toggleFavorite,
  type Favorite,
} from '@/lib/favorites';
import { noteTitle, useNotes } from '@/lib/queries/notes';
import { useUiPrefs, useUpdateUiPrefs } from '@/lib/queries/profile';
import { pageLabel, useTree } from '@/lib/queries/tree';
import { useToast } from '@/providers/toast';

// Favoritos (OB12, D297): anotações, listas e buscas guardadas, no alto da barra lateral e na
// tela de anotações. Ficam no perfil (valem em todos os aparelhos).

export function useFavorites() {
  const { t } = useTranslation();
  const toast = useToast();
  const list = readFavorites(useUiPrefs().favorites);
  const update = useUpdateUiPrefs();
  return {
    list,
    has: (f: Favorite) => isFavorite(list, f),
    toggle: (f: Favorite) => {
      const was = isFavorite(list, f);
      update.mutate(
        { favorites: toggleFavorite(list, f) },
        {
          onSuccess: () =>
            toast({ message: t(was ? 'favorites.removed' : 'favorites.added') }),
          onError: (err) => toast({ message: err.message }),
        },
      );
    },
  };
}

/** Os favoritos com o nome de agora; o que foi apagado (ou não está no aparelho) some */
export function FavoritesList({ className, header }: { className?: string; header?: ReactNode }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const favorites = useFavorites();
  const notes = useNotes({ templates: 'include' });
  const tree = useTree();
  const openPalette = useCommandPalette();
  if (!notes.data || !tree.data) return null;
  const noteById = new Map(notes.data.map((n) => [n.id, n]));
  const pageById = new Map(tree.data.pages.map((p) => [p.id, p]));
  const live = liveFavorites(favorites.list, (kind, id) =>
    kind === 'note' ? noteById.has(id) : pageById.has(id),
  );
  if (!live.length) return null;
  return (
    <View className={className}>
      {header}
      <View accessibilityRole="list" aria-label={t('favorites.title')}>
      {live.map((f) => {
        const note = f.kind === 'note' ? noteById.get(f.id) : undefined;
        const page = f.kind === 'page' ? pageById.get(f.id) : undefined;
        const label =
          f.kind === 'search'
            ? f.query
            : note
              ? noteTitle(note, t('notes.untitled'))
              : page
                ? pageLabel(page)
                : '';
        const href = note ? `/nota/${note.id}` : page ? `/page/${page.id}` : null;
        return (
          <View
            key={favoriteKey(f)}
            className={cn(
              'min-h-8 flex-row items-center rounded hover:bg-wash',
              href && pathname === href && 'bg-wash',
            )}
          >
            <Pressable
              accessibilityRole={f.kind === 'search' ? 'button' : 'link'}
              accessibilityLabel={
                f.kind === 'search' ? t('favorites.openSearch', { query: f.query }) : label
              }
              className="min-h-8 flex-1 flex-row items-center gap-2 px-2"
              onPress={() => {
                if (f.kind === 'search') openPalette(f.query);
                else if (note) router.push({ pathname: '/nota/[id]', params: { id: note.id } });
                else if (page) router.push({ pathname: '/page/[id]', params: { id: page.id } });
              }}
            >
              {f.kind === 'search' ? (
                <Icon icon={Search} tone="ink-muted" />
              ) : note ? (
                <Icon icon={FileText} tone="ink-muted" />
              ) : (
                <ItemIcon icon={page?.icon} kind={page?.view_type as ItemKind} />
              )}
              <Text numberOfLines={1} className="flex-1 text-sm text-ink">
                {label}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('favorites.removeNamed', { name: label })}
              className="h-8 w-8 items-center justify-center rounded opacity-60 hover:opacity-100"
              onPress={() => favorites.toggle(f)}
            >
              <Icon icon={X} size={16} tone="ink-muted" />
            </Pressable>
          </View>
        );
      })}
      </View>
    </View>
  );
}
