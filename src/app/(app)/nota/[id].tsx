import { router, useLocalSearchParams } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Text, textClass } from '@/components/ui/text';
import { NOTE_MAX, useNoteMutations, useNotes, type Note } from '@/lib/queries/notes';
import { useColors } from '@/lib/tokens';

// Editor de anotação (W3): título e texto simples. Salva sozinho (ao parar de digitar e ao sair).
export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const notes = useNotes();
  const note = notes.data?.find((n) => n.id === id);
  if (notes.data && !note)
    return (
      <Screen>
        <ScreenHeader title={t('notes.title')} back />
        <EmptyState title={t('notes.missing')} />
      </Screen>
    );
  // Só abre o editor com o que acabou de ler (não com o cache salvo em disco): o texto do editor é
  // estado local e não acompanharia a leitura nova
  if (!note || !notes.isFetchedAfterMount) return <Screen>{null}</Screen>;
  return <Editor key={note.id} note={note} />;
}

function Editor({ note }: { note: Note }) {
  const { t } = useTranslation();
  const colors = useColors();
  const m = useNoteMutations();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [confirm, setConfirm, closeConfirm] = useDialog<true>();
  const saved = useRef({ title: note.title, body: note.body });
  // O texto mais novo num ref: o "salvar ao sair" roda depois que a tela já saiu
  const latest = useRef({ title: note.title, body: note.body });
  useEffect(() => {
    latest.current = { title, body };
  }, [title, body]);
  const { mutate } = m.update;
  const save = useCallback(() => {
    const now = latest.current;
    if (now.title === saved.current.title && now.body === saved.current.body) return;
    saved.current = now;
    mutate({ id: note.id, ...now });
  }, [mutate, note.id]);

  // Salva 800 ms depois de parar de digitar, e ao sair da tela
  useEffect(() => {
    const timer = setTimeout(save, 800);
    return () => clearTimeout(timer);
  }, [title, body, save]);
  useEffect(() => () => save(), [save]);

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-3 pb-clear">
        <ScreenHeader
          title={t('notes.title')}
          back
          right={
            <Button
              variant="ghost"
              icon={Trash2}
              label={t('notes.delete')}
              onPress={() => setConfirm(true)}
            />
          }
        />
        <TextInput
          value={title}
          onChangeText={setTitle}
          onBlur={save}
          maxLength={200}
          placeholder={t('notes.titlePlaceholder')}
          placeholderTextColor={colors['ink-muted']}
          accessibilityLabel={t('notes.titleField')}
          className={textClass('py-1 font-serif text-xl text-ink')}
        />
        <TextInput
          value={body}
          onChangeText={setBody}
          onBlur={save}
          multiline
          maxLength={NOTE_MAX}
          placeholder={t('notes.bodyPlaceholder')}
          placeholderTextColor={colors['ink-muted']}
          accessibilityLabel={t('notes.bodyField')}
          textAlignVertical="top"
          className={textClass('min-h-64 text-base leading-6 text-ink')}
        />
        <View className="flex-row justify-end">
          <Text className="font-mono text-xs text-ink-muted">
            {body.length}/{NOTE_MAX}
          </Text>
        </View>
      </ScrollView>
      {confirm && (
        <ConfirmDialog
          title={t('notes.deleteTitle')}
          confirmLabel={t('notes.delete')}
          onClose={closeConfirm}
          onConfirm={() => {
            closeConfirm();
            saved.current = { title, body };
            m.remove.mutate(note.id);
            router.back();
          }}
        />
      )}
    </Screen>
  );
}
