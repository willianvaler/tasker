import { router } from 'expo-router';
import { LayoutTemplate, NotebookPen, Plus, Shuffle, Waypoints } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { fromTemplate, useOpenDailyNote } from '@/components/daily-note';
import { FavoritesList } from '@/components/favorites';
import { useNewNote } from '@/components/notes-block';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { ActionMenu, PromptDialog, useDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { plainText } from '@/lib/markdown-edit';
import { templateVars, timeIn } from '@/lib/note-templates';
import { noteTitle, useNoteMutations, useNotes, type Note } from '@/lib/queries/notes';
import { useTimeZone, useToday, useUiPrefs } from '@/lib/queries/profile';
import { pickRandom } from '@/lib/search';
import { useToast } from '@/providers/toast';

// Todas as anotações (W3), da mais recente para a mais antiga. Em cima, a nota do dia e "do
// modelo"; embaixo, os modelos (OB5, D290).
export default function NotesScreen() {
  const { t } = useTranslation();
  const notes = useNotes();
  const templates = useNotes({ templates: 'only' });
  const newNote = useNewNote();
  const openDaily = useOpenDailyNote();
  const m = useNoteMutations();
  const toast = useToast();
  const today = useToday();
  const timeZone = useTimeZone();
  const dailyTemplate = useUiPrefs().notes?.dailyTemplate;
  const [picking, setPicking, closePicking] = useDialog<true>();
  const [naming, setNaming, closeNaming] = useDialog<Note>();
  // As pessoais (as de pasta ficam na pasta)
  const list = (notes.data ?? []).filter((n) => !n.folder_id);
  const templateList = templates.data ?? [];

  const open = (id: string) => router.push({ pathname: '/nota/[id]', params: { id } });
  const createFrom = (template: Note, title: string) =>
    m.create
      .mutateAsync({
        title,
        ...fromTemplate(template, { date: today, time: timeIn(timeZone), title }),
      })
      .then(open)
      .catch((err: Error) => toast({ message: err.message }));
  const newTemplate = () =>
    m.create
      .mutateAsync({ title: t('templatesNotes.newTitle'), isTemplate: true })
      .then(open)
      .catch((err: Error) => toast({ message: err.message }));

  return (
    <Screen>
      <ScreenScroll contentContainerClassName="gap-4 pb-clear">
        <ScreenHeader
          title={t('notes.title')}
          back
          right={<Button icon={Plus} label={t('notes.new')} onPress={newNote} />}
        />
        <View className="flex-row flex-wrap gap-2">
          <Button
            variant="ghost"
            icon={NotebookPen}
            label={t('dailyNote.open')}
            onPress={() => void openDaily()}
          />
          <Button
            variant="ghost"
            icon={Waypoints}
            label={t('graph.title')}
            onPress={() => router.push('/grafo')}
          />
          <Button
            variant="ghost"
            icon={Shuffle}
            label={t('notes.random')}
            disabled={!notes.data?.length}
            onPress={() => {
              const pick = pickRandom(notes.data ?? []);
              if (pick) open(pick.id);
            }}
          />
          {templateList.length > 0 && (
            <Button
              variant="ghost"
              icon={LayoutTemplate}
              label={t('templatesNotes.fromTemplate')}
              onPress={() => setPicking(true)}
            />
          )}
        </View>
        {/* OB12: favoritos (os mesmos do alto da barra lateral) */}
        <FavoritesList header={<SectionLabel title={t('favorites.title')} />} />
        {notes.data && list.length === 0 && <EmptyState title={t('notes.empty')} />}
        <View>
          {list.map((note) => (
            <NoteItem key={note.id} note={note} onPress={() => open(note.id)} />
          ))}
        </View>

        <View accessibilityRole="list" aria-label={t('templatesNotes.title')}>
          <SectionLabel
            title={t('templatesNotes.title')}
            count={templateList.length || undefined}
            right={
              <Button
                variant="ghost"
                icon={Plus}
                label={t('templatesNotes.new')}
                onPress={newTemplate}
              />
            }
          />
          {templates.data && templateList.length === 0 && (
            <Text className="py-2 text-sm text-ink-muted">
              {t('templatesNotes.empty', { vars: templateVars(t('templatesNotes.varNames')) })}
            </Text>
          )}
          {templateList.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              badge={note.id === dailyTemplate ? t('templatesNotes.dailyBadge') : undefined}
              onPress={() => open(note.id)}
            />
          ))}
        </View>
      </ScreenScroll>
      {picking && (
        <ActionMenu
          title={t('templatesNotes.fromTemplate')}
          onClose={closePicking}
          actions={templateList.map((tpl) => ({
            label: noteTitle(tpl, t('notes.untitled')),
            onPress: () => {
              closePicking();
              setNaming(tpl);
            },
          }))}
        />
      )}
      {naming && (
        <PromptDialog
          title={t('templatesNotes.fromTemplate')}
          message={t('templatesNotes.nameHint', { name: noteTitle(naming, t('notes.untitled')) })}
          fields={[{ key: 'title', placeholder: t('notes.titlePlaceholder'), maxLength: 200 }]}
          validate={() => true}
          confirmLabel={t('templatesNotes.create')}
          onClose={closeNaming}
          onConfirm={(v) => {
            closeNaming();
            void createFrom(naming, v.title.trim());
          }}
        />
      )}
    </Screen>
  );
}

function NoteItem({ note, badge, onPress }: { note: Note; badge?: string; onPress: () => void }) {
  const { t, i18n } = useTranslation();
  const when = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' });
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      className="gap-1 border-b border-line px-2 py-3 hover:bg-wash"
    >
      <View className="flex-row items-baseline gap-2">
        <Text className="flex-1 text-base font-semibold text-ink" numberOfLines={1}>
          {noteTitle(note, t('notes.untitled'))}
        </Text>
        {badge && <Text className="text-xs text-accent">{badge}</Text>}
        <Text className="font-mono text-xs text-ink-muted">
          {when.format(new Date(note.updated_at.replace(' ', 'T')))}
        </Text>
      </View>
      {!!note.body.trim() && (
        <Text className="text-sm text-ink-muted" numberOfLines={2}>
          {plainText(note.body)}
        </Text>
      )}
    </Pressable>
  );
}
