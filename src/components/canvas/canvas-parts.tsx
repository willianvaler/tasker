import { ArrowUpRight, FileText, Folder, List, SquareCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Linking, Pressable, ScrollView, View } from 'react-native';

import { openItem } from '@/components/note-links';
import { useToggleWithUndo } from '@/components/tasks/task-row';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogFrame } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  cardRef,
  isImageUrl,
  readCanvas,
  type Canvas,
  type CanvasColor,
  type CanvasNode,
} from '@/lib/canvas';
import { plainText } from '@/lib/markdown-edit';
import { actorCan } from '@/lib/permissions';
import { useLinkCandidates, type LinkCandidate } from '@/lib/queries/links';
import { noteTitle, useNotes } from '@/lib/queries/notes';
import { useFolderActor } from '@/lib/queries/projects';
import { useTask } from '@/lib/queries/tasks';
import { pageLabel, useTree, useTreeMutations, type Page } from '@/lib/queries/tree';
import type { ColorToken } from '@/lib/tokens';
import type { LinkKind } from '@/lib/wikilinks';
import { useToast } from '@/providers/toast';
import { useCanWrite, useTaskCan } from '@/providers/write';

// Peças do canvas (OB10, D295) usadas pela web (React Flow) e pelo celular (lista).

/** As 6 cores do JSON Canvas nos tokens do tema (valem no claro e no escuro) */
export const COLOR_TOKEN: Record<CanvasColor, ColorToken> = {
  '1': 'danger',
  '2': 'accent',
  '3': 'warn',
  '4': 'ok',
  '5': 'rarity-rare',
  '6': 'rarity-epic',
};

/** Gravação com espera (arrastar gera muitas mudanças): o último estado vale, e sai ao desmontar */
export function useCanvasState(page: Page) {
  const { t } = useTranslation();
  const toast = useToast();
  const m = useTreeMutations();
  const actor = useFolderActor(page.folder_id);
  const manage = useCanWrite(page.folder_id, { offline: true }) && actorCan(actor, 'page.manage');
  const [canvas, setCanvas] = useState<Canvas>(() => readCanvas(page.config));
  const pending = useRef<Canvas | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutate = m.updatePage.mutate;
  const name = page.name;
  const id = page.id;
  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = pending.current;
    pending.current = null;
    if (!next) return;
    sent.current.add(JSON.stringify(readCanvas(next)));
    mutate(
      { id, name, config: next },
      { onError: (err) => toast({ message: t('page.error', { message: err.message }) }) },
    );
  };
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => () => flushRef.current(), []);
  // A versão do servidor muda (o cache do disco abriu antes, outra pessoa mexeu): vale a nova, a
  // menos que seja o eco do que esta tela mandou ou haja mudança daqui esperando para sair
  // Forma canônica (o jsonb do servidor muda a ordem das chaves)
  const remote = JSON.stringify(readCanvas(page.config));
  const seen = useRef(remote);
  const sent = useRef(new Set<string>());
  useEffect(() => {
    if (remote === seen.current) return;
    seen.current = remote;
    if (pending.current || sent.current.has(remote)) return;
    setCanvas(readCanvas(page.config));
  }, [remote, page.config]);
  /** `now`: grava já (soltar o cartão, apagar); senão, espera um pouco */
  const change = (next: Canvas, now = false) => {
    setCanvas(next);
    if (!manage) return;
    pending.current = next;
    if (timer.current) clearTimeout(timer.current);
    if (now) flush();
    else timer.current = setTimeout(flush, 800);
  };
  return { canvas, change, manage };
}

const KIND_ICON = { note: FileText, task: SquareCheck, page: List, folder: Folder } as const;

/** Escolher a anotação, tarefa, lista ou pasta que vira cartão (a busca do [[link]]) */
export function CardPicker({
  onPick,
  onClose,
}: {
  onPick: (c: LinkCandidate) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const list = useLinkCandidates(text);
  return (
    <DialogFrame onClose={onClose} wide>
      <Text className="text-lg font-semibold text-ink">{t('canvas.addCard')}</Text>
      <Input
        autoFocus
        accessibilityLabel={t('canvas.search')}
        placeholder={t('canvas.search')}
        value={text}
        onChangeText={setText}
      />
      <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
        {list.length === 0 && (
          <Text className="py-2 text-sm text-ink-muted">{t('canvas.searchHint')}</Text>
        )}
        {list.map((c) => (
          <Pressable
            key={`${c.kind}:${c.id}`}
            accessibilityRole="button"
            onPress={() => onPick(c)}
            className="min-h-10 flex-row items-center gap-2 rounded px-2 py-2 hover:bg-wash"
          >
            <Icon icon={KIND_ICON[c.kind]} size={16} tone="ink-muted" />
            <View className="flex-1">
              <Text numberOfLines={1} className="text-sm text-ink">
                {c.title}
              </Text>
              {!!c.context && (
                <Text numberOfLines={1} className="text-xs text-ink-muted">
                  {c.context}
                </Text>
              )}
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <Button variant="ghost" label={t('common.cancel')} onPress={onClose} className="self-end" />
    </DialogFrame>
  );
}

/** O conteúdo do cartão de verdade: anotação (com as primeiras linhas), tarefa, lista ou pasta */
export function RefCard({ kind, id }: { kind: LinkKind; id: string }) {
  if (kind === 'task') return <TaskCard id={id} />;
  if (kind === 'note') return <NoteCard id={id} />;
  return <PlaceCard kind={kind} id={id} />;
}

function OpenButton({ kind, id, title }: { kind: LinkKind; id: string; title: string }) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t('base.open', { title })}
      onPress={() => openItem(kind, id)}
      className="nodrag h-8 w-8 items-center justify-center rounded hover:bg-wash"
    >
      <Icon icon={ArrowUpRight} size={16} tone="ink-muted" />
    </Pressable>
  );
}

function Missing() {
  const { t } = useTranslation();
  return <Text className="p-3 text-sm italic text-ink-muted">{t('canvas.missing')}</Text>;
}

function TaskCard({ id }: { id: string }) {
  const task = useTask(id);
  if (task.data === null) return <Missing />;
  if (!task.data) return null;
  return <TaskCardBody task={task.data} />;
}

function TaskCardBody({ task }: { task: NonNullable<ReturnType<typeof useTask>['data']> }) {
  const { t } = useTranslation();
  const can = useTaskCan(task);
  const toggle = useToggleWithUndo();
  const done = task.status === 'done';
  return (
    <View className="flex-row items-start gap-1 p-1">
      <View className="nodrag">
        <Checkbox
          checked={done}
          disabled={!can.complete}
          label={t(done ? 'task.reopen' : 'task.complete', { title: task.title })}
          onChange={(checked) => toggle(task, checked)}
        />
      </View>
      <View className="flex-1 py-2">
        <Text
          numberOfLines={3}
          className={done ? 'text-sm text-ink-muted line-through' : 'text-sm text-ink'}
        >
          {task.title}
        </Text>
        {!!task.due_date && <Text className="text-xs text-ink-muted">{task.due_date}</Text>}
      </View>
      <OpenButton kind="task" id={task.id} title={task.title} />
    </View>
  );
}

function NoteCard({ id }: { id: string }) {
  const { t } = useTranslation();
  const notes = useNotes();
  if (!notes.data) return null;
  const note = notes.data.find((n) => n.id === id);
  if (!note) return <Missing />;
  const title = noteTitle(note, t('notes.untitled'));
  const preview = plainText(note.body)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l !== title)
    .slice(0, 4)
    .join('\n');
  return (
    <View className="flex-1 gap-1 p-3">
      <View className="flex-row items-start gap-2">
        <Icon icon={FileText} size={16} tone="accent" />
        <Text numberOfLines={2} className="flex-1 font-semibold text-ink">
          {title}
        </Text>
        <OpenButton kind="note" id={note.id} title={title} />
      </View>
      {!!preview && (
        <Text numberOfLines={6} className="text-xs text-ink-muted">
          {preview}
        </Text>
      )}
    </View>
  );
}

function PlaceCard({ kind, id }: { kind: 'page' | 'folder'; id: string }) {
  const tree = useTree();
  if (!tree.data) return null;
  const page = kind === 'page' ? tree.data.pages.find((p) => p.id === id) : undefined;
  const folder =
    kind === 'folder'
      ? tree.data.folders.flatMap((f) => [f, ...f.children]).find((f) => f.id === id)
      : undefined;
  const title = page ? pageLabel(page) : folder?.name;
  if (!title) return <Missing />;
  return (
    <View className="flex-row items-center gap-2 p-3">
      <Icon icon={kind === 'page' ? List : Folder} size={16} tone="ink-muted" />
      <Text numberOfLines={2} className="flex-1 font-semibold text-ink">
        {title}
      </Text>
      <OpenButton kind={kind} id={id} title={title} />
    </View>
  );
}

/** Cartão de endereço: imagem mostra a imagem; o resto, o endereço com o botão de abrir */
export function LinkCard({ url }: { url: string }) {
  const { t } = useTranslation();
  if (isImageUrl(url))
    return (
      <Image
        source={{ uri: url }}
        accessibilityLabel={url}
        resizeMode="contain"
        style={{ width: '100%', height: '100%' }}
      />
    );
  return (
    <View className="flex-row items-center gap-2 p-3">
      <Text numberOfLines={3} className="flex-1 text-sm text-accent underline">
        {url}
      </Text>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('canvas.openUrl')}
        onPress={() => void Linking.openURL(url)}
        className="nodrag h-8 w-8 items-center justify-center rounded hover:bg-wash"
      >
        <Icon icon={ArrowUpRight} size={16} tone="ink-muted" />
      </Pressable>
    </View>
  );
}

/** O título de cada cartão de verdade (exportar, leitor de tela) */
export function useCardTitles() {
  const { t } = useTranslation();
  const notes = useNotes();
  const tree = useTree();
  return (node: CanvasNode): string => {
    const ref = cardRef(node);
    if (!ref) return node.text ?? node.label ?? node.url ?? node.file ?? '';
    if (ref.kind === 'note') {
      const note = notes.data?.find((n) => n.id === ref.id);
      return note ? noteTitle(note, t('notes.untitled')) : '';
    }
    if (ref.kind === 'page') {
      const page = tree.data?.pages.find((p) => p.id === ref.id);
      return page ? pageLabel(page) : '';
    }
    if (ref.kind === 'folder')
      return (
        tree.data?.folders.flatMap((f) => [f, ...f.children]).find((f) => f.id === ref.id)?.name ??
        ''
      );
    return '';
  };
}
