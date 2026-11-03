import { router, useLocalSearchParams } from 'expo-router';
import {
  Bold,
  Eye,
  Heading2,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  ListTree,
  MoreHorizontal,
  Pencil,
  Trash2,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { DailyJournal } from '@/components/daily-note';
import { useFavorites } from '@/components/favorites';
import { NoteHistory } from '@/components/note-history';
import { LocalGraph } from '@/components/graph/local-graph';
import { Screen, ScreenScroll } from '@/components/screen';
import {
  CloseSide,
  PagePane,
  parseSide,
  sideParam,
  SidePicker,
  useCanSplit,
} from '@/components/split-pane';
import { ScreenHeader } from '@/components/screen-header';
import { NoteMarkdown } from '@/components/note-markdown';
import { NoteProperties } from '@/components/note-properties';
import {
  BacklinkChips,
  Backlinks,
  OutgoingLinks,
  UnlinkedMentions,
  useOpenLink,
} from '@/components/note-links';
import { useSlashCommands } from '@/components/slash-commands';
import { useWikilinkAutocomplete } from '@/components/wikilink-autocomplete';
import { Button, IconButton } from '@/components/ui/button';
import { ActionMenu, ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Text, textClass } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { applyFormat, type Format, type Selection } from '@/lib/markdown-edit';
import { noteOutline, outlineIndex, wordCount } from '@/lib/note-blocks';
import { noteAliases, type NoteProps } from '@/lib/note-props';
import { isDailyNote, templateVars } from '@/lib/note-templates';
import { useUiPrefs, useUpdateUiPrefs } from '@/lib/queries/profile';
import { useLinkTitles } from '@/lib/queries/links';
import { NOTE_MAX, useNoteMutations, useNotes, type Note } from '@/lib/queries/notes';
import { useColors } from '@/lib/tokens';
import { parseLinks } from '@/lib/wikilinks';

// Editor de anotação (W3, D187): título e texto em Markdown simples, com a barra de formatação e
// a visualização formatada. Salva sozinho (ao parar de digitar e ao sair).
export default function NoteScreen() {
  // `secao`: a âncora de um link [[Anotação#Seção]] (OB1): abre formatada e rola até o título.
  // `lado`: a anotação ou lista aberta ao lado, no computador (OB12)
  const { id, secao, lado } = useLocalSearchParams<{ id: string; secao?: string; lado?: string }>();
  const canSplit = useCanSplit();
  const side = canSplit ? parseSide(lado) : null;
  const closeSide = () => router.setParams({ lado: undefined });
  const main = <NoteMain id={id} section={secao} canSplit={canSplit} split={!!side && side.id !== id} />;
  if (!side || side.id === id) return main;
  return (
    <View className="flex-1 flex-row bg-paper">
      <View className="flex-1">{main}</View>
      <View testID="side-pane" className="flex-1 border-l border-line">
        {side.kind === 'note' ? (
          <NoteMain key={side.id} id={side.id} pane={closeSide} />
        ) : (
          <PagePane key={side.id} id={side.id} onClose={closeSide} />
        )}
      </View>
    </View>
  );
}

function NoteMain({
  id,
  section,
  canSplit = false,
  split = false,
  pane,
}: {
  id: string;
  section?: string;
  canSplit?: boolean;
  /** Há outra coisa aberta ao lado: o sumário vai para o menu */
  split?: boolean;
  /** Ao lado de outra (OB12): sem "Voltar", com o fechar do lado */
  pane?: () => void;
}) {
  const { t } = useTranslation();
  // Relê sempre: logo depois de criar, a lista ainda é "nova" (staleTime) e não seria relida, e o
  // editor ficava em branco até sair e voltar
  const notes = useNotes({ fresh: true, templates: 'include' });
  const found = notes.data?.find((n) => n.id === id);
  // A anotação some por um instante logo depois da primeira sincronização (a leitura passa para o
  // banco do aparelho antes de ela chegar lá): o editor fechava e abria vazio, e o que tinha sido
  // digitado se perdia. Fica a última versão vista
  const [kept, setKept] = useState<Note | undefined>();
  if (found && found !== kept) setKept(found);
  const note = found ?? (kept?.id === id ? kept : undefined);
  if (notes.data && !note)
    return (
      <Screen>
        <ScreenHeader
          title={t('notes.title')}
          back={!pane}
          right={pane ? <CloseSide onClose={pane} /> : undefined}
        />
        <EmptyState title={t('notes.missing')} />
      </Screen>
    );
  // Só abre o editor com o que acabou de ler (não com o cache salvo em disco): o texto do editor é
  // estado local e não acompanharia a leitura nova. Se a leitura não vier (sem conexão, pausada),
  // abre com o que há, em vez de ficar em branco (no celular a tela parava aqui, 20/10)
  if (!note || (!notes.isFetchedAfterMount && notes.fetchStatus === 'fetching'))
    return <Screen>{null}</Screen>;
  return (
    <Editor
      key={note.id}
      note={note}
      section={section}
      canSplit={canSplit}
      compact={split || !!pane}
      pane={pane}
    />
  );
}

function Editor({
  note,
  section,
  canSplit,
  compact,
  pane,
}: {
  note: Note;
  section?: string;
  canSplit: boolean;
  compact: boolean;
  pane?: () => void;
}) {
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
  const scroll = useRef<ScrollView>(null);
  const [confirm, setConfirm, closeConfirm] = useDialog<true>();
  const [outlineMenu, setOutlineMenu, closeOutlineMenu] = useDialog<true>();
  const [moreMenu, setMoreMenu, closeMoreMenu] = useDialog<true>();
  const [history, setHistory, closeHistory] = useDialog<true>();
  // OB12: favorito e tela dividida
  const favorites = useFavorites();
  const favorite = favorites.has({ kind: 'note', id: note.id });
  const [picking, setPicking, closePicking] = useDialog<true>();
  // Modelos (OB5, D290): esta anotação é modelo? É a da nota do dia?
  const dailyTemplate = useUiPrefs().notes?.dailyTemplate;
  const updatePrefs = useUpdateUiPrefs();
  const isTemplate = !!note.is_template;
  const daily = isDailyNote({ ...note, title });
  // Sumário ao lado do texto no computador (OB3); no celular, num menu
  const wideOutline = useWindowDimensions().width >= 1024 && !compact;
  // Propriedades (OB4): salvas junto com o texto
  const [props, setProps] = useState<NoteProps>(note.props ?? {});
  const saved = useRef({ title: note.title, body: note.body, props: note.props ?? {} });
  // O texto mais novo num ref: o "salvar ao sair" roda depois que a tela já saiu
  const latest = useRef({ title: note.title, body: note.body, props: note.props ?? {} });
  useEffect(() => {
    latest.current = { title, body, props };
  }, [title, body, props]);
  const { mutate } = m.update;
  const save = useCallback(() => {
    const now = latest.current;
    if (
      now.title === saved.current.title &&
      now.body === saved.current.body &&
      JSON.stringify(now.props) === JSON.stringify(saved.current.props)
    )
      return;
    saved.current = now;
    mutate({ id: note.id, ...now });
  }, [mutate, note.id]);

  // Salva 800 ms depois de parar de digitar, e ao sair da tela
  useEffect(() => {
    const timer = setTimeout(save, 800);
    return () => clearTimeout(timer);
  }, [title, body, props, save]);
  useEffect(() => () => save(), [save]);

  // Links [[...]] (OB1, D286): autocomplete no editor; formatada, abrem por dentro do app
  const autocomplete = useWikilinkAutocomplete({
    text: body,
    caret: selection.end,
    setText: (value, caret) => {
      setBody(value);
      setSelection({ start: caret, end: caret });
      setForced({ start: caret, end: caret });
    },
    inputRef: input,
    exclude: note.id,
  });
  // Comandos de barra (OB3): "/" no começo da linha
  const slash = useSlashCommands({
    text: body,
    caret: selection.end,
    setText: (value, caret) => {
      setBody(value);
      setSelection({ start: caret, end: caret });
      setForced({ start: caret, end: caret });
    },
    inputRef: input,
  });
  const resolve = useLinkTitles(
    parseLinks(`${body}\n${Object.values(props).join('\n')}`).flatMap((l) =>
      l.kind && l.id ? [{ kind: l.kind, id: l.id }] : [],
    ),
  );
  const openLink = useOpenLink({ folderId: note.folder_id, body, setBody });
  // Onde cada título ficou na visualização; a âncora do link (ou o toque no sumário) rola até ele
  const outline = noteOutline(body);
  const headingY = useRef<Record<number, number>>({});
  const pending = useRef(section ? outlineIndex(body, section) : -1);
  function onHeadingLayout(index: number, y: number) {
    headingY.current[index] = y;
    if (index !== pending.current) return;
    pending.current = -1;
    scroll.current?.scrollTo({ y, animated: true });
  }
  function goToHeading(index: number) {
    const y = headingY.current[index];
    if (!editing && y !== undefined) {
      scroll.current?.scrollTo({ y, animated: true });
      return;
    }
    pending.current = index;
    if (editing) {
      save();
      setEditing(false);
    }
  }

  function insertLink() {
    const start = Math.min(selection.start, selection.end);
    const next = body.slice(0, start) + '[[' + body.slice(Math.max(selection.start, selection.end));
    setBody(next);
    setSelection({ start: start + 2, end: start + 2 });
    setForced({ start: start + 2, end: start + 2 });
  }

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
      {/* No celular, o teclado cobria o texto (20/10): a tela encolhe acima dele */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={
          Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined
        }
      >
        <ScreenHeader
          title={t('notes.title')}
          back={!pane}
          right={
            <>
              {pane && <CloseSide onClose={pane} />}
              <IconButton
                icon={MoreHorizontal}
                label={t('templatesNotes.more')}
                tone="ink"
                onPress={() => setMoreMenu(true)}
              />
              <Button
                destructive
                variant="ghost"
                icon={Trash2}
                label={t('notes.delete')}
                onPress={() => setConfirm(true)}
              />
            </>
          }
        />
        {isTemplate && (
          <View testID="template-banner" className="rounded-lg bg-wash px-3 py-2">
            <Text className="text-sm text-ink">
              {note.id === dailyTemplate
                ? t('templatesNotes.bannerDaily')
                : t('templatesNotes.banner')}
            </Text>
            <Text className="text-xs text-ink-muted">
              {t('templatesNotes.variables', { vars: templateVars(t('templatesNotes.varNames')) })}
            </Text>
          </View>
        )}
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
          {editing && (
            <IconButton
              icon={Link2}
              label={t('wikilinks.insert')}
              tone="ink"
              onPress={insertLink}
            />
          )}
          {!wideOutline && outline.length > 0 && (
            <IconButton
              icon={ListTree}
              label={t('notes.outline')}
              tone="ink"
              className={editing ? undefined : 'ml-auto'}
              onPress={() => setOutlineMenu(true)}
            />
          )}
          <Button
            variant="ghost"
            icon={editing ? Eye : Pencil}
            label={t(editing ? 'notes.preview' : 'notes.edit')}
            className={!wideOutline && outline.length > 0 && !editing ? undefined : 'ml-auto'}
            onPress={() => {
              save();
              setEditing(!editing);
            }}
          />
        </View>
        {/* Escrevendo, o "Citado em" fica numa linha curta (a anotação nova de um link já mostra de onde veio) */}
        <NoteProperties
          props={props}
          onChange={setProps}
          editable={editing}
          resolve={resolve}
          onLink={openLink}
        />
        {editing && !autocomplete.open && !slash.open && (
          <View className="pt-2">
            <BacklinkChips kind="note" id={note.id} />
          </View>
        )}
        {editing && autocomplete.list}
        {editing && !autocomplete.open && slash.list}
        <View className="flex-1 flex-row gap-6">
          <View className="flex-1">
            {editing ? (
              // O campo ocupa o resto da tela e rola por dentro
              <TextInput
                ref={input}
                value={body}
                onChangeText={(value) => {
                  setBody(value);
                  autocomplete.onChangeText();
                  slash.onChangeText();
                }}
                onKeyPress={(e) => autocomplete.onKeyPress(e) || slash.onKeyPress(e)}
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
              <ScreenScroll
                ref={scroll}
                className="flex-1"
                contentContainerClassName="py-3 pb-clear"
              >
                {body.trim() ? (
                  <NoteMarkdown
                    value={body}
                    resolve={resolve}
                    onLink={openLink}
                    onHeadingLayout={onHeadingLayout}
                  />
                ) : (
                  <Text className="text-ink-muted">{t('notes.bodyPlaceholder')}</Text>
                )}
                {/* OB2: quem cita esta, o que ela cita e onde o título aparece sem link */}
                <Backlinks kind="note" id={note.id} />
                <OutgoingLinks body={body} resolve={resolve} onOpen={openLink} />
                <UnlinkedMentions note={note} title={title} aliases={noteAliases(props)} />
                {/* OB9: o grafo local, com os vizinhos até 2 passos */}
                <LocalGraph kind="note" id={note.id} />
                {daily && <DailyJournal date={title.trim()} />}
              </ScreenScroll>
            )}
          </View>
          {wideOutline && outline.length > 0 && (
            <View
              role="navigation"
              aria-label={t('notes.outline')}
              className="w-56 gap-1 border-l border-line py-3 pl-4"
            >
              <Text className="pb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {t('notes.outline')}
              </Text>
              {outline.map((h, i) => (
                <Pressable
                  key={i}
                  accessibilityRole="link"
                  onPress={() => goToHeading(i)}
                  className="rounded px-1 py-1 hover:bg-wash"
                  style={{ paddingLeft: 4 + (Math.min(h.level, 4) - 1) * 12 }}
                >
                  <Text
                    numberOfLines={2}
                    className={cn('text-sm', h.level === 1 ? 'text-ink' : 'text-ink-muted')}
                  >
                    {h.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
        <View className="flex-row justify-between gap-3 py-2">
          <Text className="flex-1 text-xs text-ink-muted" numberOfLines={1}>
            {editing ? t('notes.markdownHint') : ''}
          </Text>
          <Text className="font-mono text-xs text-ink-muted">
            {t('notes.words', { count: wordCount(body) })} · {body.length}/{NOTE_MAX}
          </Text>
        </View>
      </KeyboardAvoidingView>
      {outlineMenu && (
        <ActionMenu
          title={t('notes.outline')}
          onClose={closeOutlineMenu}
          actions={outline.map((h, i) => ({
            label: `${'  '.repeat(Math.min(h.level, 4) - 1)}${h.text}`,
            onPress: () => {
              closeOutlineMenu();
              goToHeading(i);
            },
          }))}
        />
      )}
      {moreMenu && (
        <ActionMenu
          title={t('templatesNotes.more')}
          onClose={closeMoreMenu}
          actions={[
            {
              label: t(favorite ? 'favorites.remove' : 'favorites.add'),
              onPress: () => {
                closeMoreMenu();
                favorites.toggle({ kind: 'note', id: note.id });
              },
            },
            ...(canSplit && !pane
              ? [
                  {
                    label: t('split.open'),
                    onPress: () => {
                      closeMoreMenu();
                      setPicking(true);
                    },
                  },
                ]
              : []),
            {
              label: t('noteHistory.open'),
              onPress: () => {
                closeMoreMenu();
                save();
                setHistory(true);
              },
            },
            {
              label: t(isTemplate ? 'templatesNotes.unmark' : 'templatesNotes.mark'),
              onPress: () => {
                closeMoreMenu();
                save();
                m.update.mutate({ id: note.id, is_template: !isTemplate });
                if (isTemplate && note.id === dailyTemplate)
                  updatePrefs.mutate({ notes: { dailyTemplate: null } });
              },
            },
            ...(isTemplate
              ? [
                  {
                    label: t(
                      note.id === dailyTemplate
                        ? 'templatesNotes.unsetDaily'
                        : 'templatesNotes.setDaily',
                    ),
                    onPress: () => {
                      closeMoreMenu();
                      updatePrefs.mutate({
                        notes: { dailyTemplate: note.id === dailyTemplate ? null : note.id },
                      });
                    },
                  },
                ]
              : []),
          ]}
        />
      )}
      {picking && (
        <SidePicker
          exclude={note.id}
          onClose={closePicking}
          onPick={(side) => {
            closePicking();
            save();
            router.setParams({ lado: sideParam(side) });
          }}
        />
      )}
      {history && (
        <NoteHistory
          noteId={note.id}
          current={{ title, body }}
          canEdit
          onClose={closeHistory}
          onRestored={(restored) => {
            // O servidor já tem o texto restaurado: o editor só troca o que mostra
            saved.current = restored;
            latest.current = restored;
            setTitle(restored.title);
            setBody(restored.body);
            setProps(restored.props);
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={t('notes.deleteTitle')}
          confirmLabel={t('notes.delete')}
          destructive
          onClose={closeConfirm}
          onConfirm={() => {
            closeConfirm();
            saved.current = { title, body, props };
            m.remove.mutate(note.id);
            if (pane) pane();
            else router.back();
          }}
        />
      )}
    </Screen>
  );
}
