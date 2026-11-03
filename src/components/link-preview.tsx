import { useTranslation } from 'react-i18next';
import { Platform, View, type ViewStyle } from 'react-native';

import { BodyPortal } from '@/components/body-portal';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { plainText } from '@/lib/markdown-edit';
import { noteSection, previewLines } from '@/lib/note-embeds';
import { formatDueDate } from '@/lib/parser/dates';
import { noteTitle, useNotes } from '@/lib/queries/notes';
import { useToday } from '@/lib/queries/profile';
import { usePageTasks, useTask } from '@/lib/queries/tasks';
import { findFolder, pageLabel, useTree } from '@/lib/queries/tree';
import type { LinkHref, LinkKind } from '@/lib/wikilinks';

export type PeekTarget = { kind: LinkKind; id: string; anchor: string | null };
/** Onde o ponteiro está (prévia ao passar o mouse) ou null (toque longo: diálogo) */
export type Peek = { target: PeekTarget; at: { x: number; y: number } | null };

const CARD_WIDTH = 320;

/** Título e as primeiras linhas do destino de um link (OB6, D291) */
function usePreview(target: PeekTarget): { title: string; text: string } | null {
  const { t } = useTranslation();
  const today = useToday();
  const notes = useNotes({ templates: 'include' });
  const task = useTask(target.kind === 'task' ? target.id : undefined);
  const tree = useTree();
  const pageTasks = usePageTasks(target.kind === 'page' ? target.id : undefined);
  switch (target.kind) {
    case 'note': {
      const note = notes.data?.find((n) => n.id === target.id);
      if (!note) return null;
      const body = previewLines(noteSection(note.body, target.anchor), 8);
      return {
        title: noteTitle(note, t('notes.untitled')),
        text: plainText(body) || t('embeds.empty'),
      };
    }
    case 'task': {
      if (!task.data) return null;
      const parts = [
        task.data.status === 'done' ? t('linkPreview.done') : t('linkPreview.open'),
        task.data.due_date ? formatDueDate(task.data.due_date, today) : null,
      ].filter(Boolean);
      const notesText = previewLines(task.data.notes ?? '', 4);
      return {
        title: task.data.title,
        text: [parts.join(' · '), plainText(notesText)].filter(Boolean).join('\n'),
      };
    }
    case 'page': {
      const page = tree.data?.pages.find((p) => p.id === target.id);
      if (!page) return null;
      const open = (pageTasks.data ?? []).filter((x) => !x.parent_task_id && x.status !== 'done');
      return {
        title: pageLabel(page),
        text: [
          t('linkPreview.openTasks', { count: open.length }),
          ...open.slice(0, 5).map((x) => `☐ ${x.title}`),
        ].join('\n'),
      };
    }
    case 'folder': {
      const folder = findFolder(tree.data, target.id)?.folder;
      return folder ? { title: folder.name, text: t('linkPreview.folder') } : null;
    }
  }
}

/**
 * Prévia de um link [[...]] (OB6): ao passar o mouse (web), um cartão perto do ponteiro com o
 * título e as primeiras linhas; no toque longo, um diálogo com "Abrir".
 */
export function LinkPreview({
  peek,
  onClose,
  onOpen,
}: {
  peek: Peek;
  onClose: () => void;
  onOpen: (href: LinkHref) => void;
}) {
  const { t } = useTranslation();
  const preview = usePreview(peek.target);
  if (!peek.at) {
    if (!preview) return null;
    return (
      <ConfirmDialog
        title={preview.title}
        message={preview.text}
        confirmLabel={t('linkPreview.openButton')}
        onClose={onClose}
        onConfirm={() => {
          onClose();
          onOpen(peek.target);
        }}
      />
    );
  }
  if (!preview || Platform.OS !== 'web') return null;
  const viewport =
    typeof window !== 'undefined'
      ? { width: window.innerWidth, height: window.innerHeight }
      : { width: 1024, height: 768 };
  const left = Math.max(8, Math.min(peek.at.x - 24, viewport.width - CARD_WIDTH - 8));
  // Na metade de baixo da tela, abre para cima do ponteiro
  const below = peek.at.y < viewport.height * 0.55;
  // `fixed` existe só na web (o react-native-web repassa para o CSS)
  const style = {
    position: 'fixed',
    left,
    ...(below ? { top: peek.at.y + 18 } : { bottom: viewport.height - peek.at.y + 18 }),
    width: CARD_WIDTH,
    zIndex: 50,
  } as unknown as ViewStyle;
  return (
    <BodyPortal>
      <View
        pointerEvents="none"
        role="tooltip"
        testID="link-preview"
        style={style}
        className="gap-1 rounded-lg border border-line bg-surface p-3"
      >
        <Text numberOfLines={1} className="font-semibold text-ink">
          {preview.title}
        </Text>
        <Text numberOfLines={8} className="text-sm text-ink-muted">
          {preview.text}
        </Text>
      </View>
    </BodyPortal>
  );
}
