import { router, useLocalSearchParams } from 'expo-router';
import {
  Bold,
  Eye,
  Heading2,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Pencil,
  Trash2,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { NoteMarkdown } from '@/components/note-markdown';
import { Button, IconButton } from '@/components/ui/button';
import { ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Text, textClass } from '@/components/ui/text';
import { applyFormat, type Format, type Selection } from '@/lib/markdown-edit';
import { NOTE_MAX, useNoteMutations, useNotes, type Note } from '@/lib/queries/notes';
import { useColors } from '@/lib/tokens';

// Editor de anotação (W3, D187): título e texto em Markdown simples, com a barra de formatação e
// a visualização formatada. Salva sozinho (ao parar de digitar e ao sair).
export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  // Relê sempre: logo depois de criar, a lista ainda é "nova" (staleTime) e não seria relida, e o
  // editor ficava em branco até sair e voltar
  const notes = useNotes({ fresh: true });
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
  // Com texto, abre formatada; vazia, já no editor
  const [editing, setEditing] = useState(!note.body.trim());
  const [selection, setSelection] = useState<Selection>({
    start: note.body.length,
    end: note.body.length,
  });
  // Seleção imposta depois de formatar; some no próximo movimento do cursor
  const [forced, setForced] = useState<Selection | undefined>();
  const input = useRef<TextInput>(null);
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

  function format(kind: Format) {
    const next = applyFormat(body, selection, kind);
    setBody(next.text);
    setSelection(next.selection);
    setForced(next.selection);
  }
  // Depois de formatar, o foco volta ao texto (o toque no botão tirou, na web)
  useEffect(() => {
    if (forced) input.current?.focus();
  }, [forced]);

  const tools: { kind: Format; icon: LucideIcon; label: string }[] = [
    { kind: 'bold', icon: Bold, label: t('notes.bold') },
    { kind: 'italic', icon: Italic, label: t('notes.italic') },
    { kind: 'heading', icon: Heading2, label: t('notes.heading') },
    { kind: 'list', icon: List, label: t('notes.list') },
    { kind: 'numbered', icon: ListOrdered, label: t('notes.numbered') },
    { kind: 'task', icon: ListChecks, label: t('notes.task') },
  ];

  return (
    <Screen size="medium">
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
      <View
        accessibilityRole="toolbar"
        aria-label={t('notes.toolbar')}
        className="flex-row flex-wrap items-center gap-1 border-b border-line py-1"
      >
        {editing &&
          tools.map((tool) => (
            <IconButton
              key={tool.kind}
              icon={tool.icon}
              label={tool.label}
              tone="ink"
              onPress={() => format(tool.kind)}
            />
          ))}
        <Button
          variant="ghost"
          icon={editing ? Eye : Pencil}
          label={t(editing ? 'notes.preview' : 'notes.edit')}
          className="ml-auto"
          onPress={() => {
            save();
            setEditing(!editing);
          }}
        />
      </View>
      {editing ? (
        // O campo ocupa o resto da tela e rola por dentro
        <TextInput
          ref={input}
          value={body}
          onChangeText={setBody}
          onBlur={save}
          selection={forced}
          onSelectionChange={(e) => {
            setSelection(e.nativeEvent.selection);
            if (forced) setForced(undefined);
          }}
          multiline
          maxLength={NOTE_MAX}
          placeholder={t('notes.bodyPlaceholder')}
          placeholderTextColor={colors['ink-muted']}
          accessibilityLabel={t('notes.bodyField')}
          textAlignVertical="top"
          className={textClass('min-h-64 flex-1 py-3 text-base leading-6 text-ink')}
        />
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="py-3 pb-clear">
          {body.trim() ? (
            <NoteMarkdown value={body} />
          ) : (
            <Text className="text-ink-muted">{t('notes.bodyPlaceholder')}</Text>
          )}
        </ScrollView>
      )}
      <View className="flex-row justify-between py-2">
        <Text className="text-xs text-ink-muted">{editing ? t('notes.markdownHint') : ''}</Text>
        <Text className="font-mono text-xs text-ink-muted">
          {body.length}/{NOTE_MAX}
        </Text>
      </View>
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
