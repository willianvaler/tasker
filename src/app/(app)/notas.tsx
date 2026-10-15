import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { useNewNote } from '@/components/notes-block';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { noteTitle, useNotes } from '@/lib/queries/notes';

// Todas as anotações (W3), da mais recente para a mais antiga.
export default function NotesScreen() {
  const { t, i18n } = useTranslation();
  const notes = useNotes();
  const newNote = useNewNote();
  const when = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' });
  const list = notes.data ?? [];
  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-4 pb-clear">
        <ScreenHeader
          title={t('notes.title')}
          back
          right={<Button icon={Plus} label={t('notes.new')} onPress={newNote} />}
        />
        {notes.data && list.length === 0 && <EmptyState title={t('notes.empty')} />}
        {list.map((note) => (
          <Pressable
            key={note.id}
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/nota/[id]', params: { id: note.id } })}
            className="gap-1 border-b border-line py-3 hover:bg-wash"
          >
            <View className="flex-row items-baseline gap-2">
              <Text className="flex-1 text-base font-semibold text-ink" numberOfLines={1}>
                {noteTitle(note, t('notes.untitled'))}
              </Text>
              <Text className="font-mono text-xs text-ink-muted">
                {when.format(new Date(note.updated_at))}
              </Text>
            </View>
            {!!note.body.trim() && (
              <Text className="text-sm text-ink-muted" numberOfLines={2}>
                {note.body}
              </Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
