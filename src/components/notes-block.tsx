import { router } from 'expo-router';
import { Plus, StickyNote } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { IconButton } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { noteTitle, useNoteMutations, useNotes } from '@/lib/queries/notes';
import { useToast } from '@/providers/toast';

/** Abre uma anotação nova (cria e vai para o editor) */
export function useNewNote() {
  const m = useNoteMutations();
  const toast = useToast();
  return () =>
    m.create
      .mutateAsync()
      .then((id) => router.push({ pathname: '/nota/[id]', params: { id } }))
      .catch((err: Error) => toast({ message: err.message }));
}

/**
 * Bloco de anotações (W3): as mais recentes, "+" para criar e "Ver todas". Na barra lateral fica
 * acima de Pastas e Projetos; no celular, no Início.
 */
export function NotesBlock({ limit = 5 }: { limit?: number }) {
  const { t } = useTranslation();
  const notes = useNotes();
  const newNote = useNewNote();
  return (
    <View>
      <SectionLabel
        title={t('notes.title')}
        count={notes.data?.length || undefined}
        right={<IconButton icon={Plus} label={t('notes.new')} onPress={newNote} />}
      />
      <NotesList limit={limit} />
    </View>
  );
}

/** As anotações mais recentes, sem o título da seção (a barra lateral usa o cabeçalho dela) */
export function NotesList({ limit = 5 }: { limit?: number }) {
  const { t } = useTranslation();
  const notes = useNotes();
  const newNote = useNewNote();
  const list = notes.data ?? [];
  return (
    <View>
      {list.length === 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={newNote}
          className="min-h-8 flex-row items-center gap-2 rounded px-2 hover:bg-wash active:bg-wash"
        >
          <Icon icon={Plus} tone="ink-muted" />
          <Text className="text-sm text-ink-muted">{t('notes.first')}</Text>
        </Pressable>
      )}
      {list.slice(0, limit).map((note) => (
        <Pressable
          key={note.id}
          accessibilityRole="link"
          onPress={() => router.push({ pathname: '/nota/[id]', params: { id: note.id } })}
          className="min-h-8 flex-row items-center gap-2 rounded px-2 hover:bg-wash active:bg-wash"
        >
          <Icon icon={StickyNote} tone="ink-muted" />
          <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
            {noteTitle(note, t('notes.untitled'))}
          </Text>
        </Pressable>
      ))}
      {list.length > limit && (
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/notas')}
          className="min-h-8 justify-center rounded px-2 hover:bg-wash"
        >
          <Text className="text-xs font-semibold text-ink">
            {t('notes.seeAll', { count: list.length })}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
