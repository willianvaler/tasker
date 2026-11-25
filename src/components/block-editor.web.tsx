import { useEffect, useRef, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { mountBlockEditor, type BlockEditorApi } from '@/lib/block-editor/mount';
import type { SlashId, SlashItem } from '@/lib/block-editor/slash';

// Editor de blocos na web (R1.1, D371): o TipTap montado direto na página. Recebe e devolve o
// Markdown da anotação (o que não foi mexido volta byte a byte, lib/block-editor/markdown.ts).

export const BLOCK_EDITOR = true;

const IDS: SlashId[] = [
  'text', 'h1', 'h2', 'h3', 'bullet', 'ordered', 'task', 'quote', 'callout', 'code', 'table',
  'divider', 'formula', 'query', 'button', 'link', 'embed', 'image', 'today',
];

export function useSlashItems(): SlashItem[] {
  const { t } = useTranslation();
  return IDS.map((id) => ({
    id,
    label: t(`blockEditor.items.${id}.label`),
    hint: t(`blockEditor.items.${id}.hint`),
    keywords: t(`blockEditor.items.${id}.keywords`),
  }));
}

export function BlockEditor({
  value,
  onChange,
  onBlur,
  editable,
  apiRef,
  onImage,
  today,
}: {
  value: string;
  onChange: (md: string) => void;
  onBlur?: () => void;
  editable: boolean;
  apiRef?: MutableRefObject<BlockEditorApi | null>;
  onImage?: () => void;
  today: string;
}) {
  const { t } = useTranslation();
  const host = useRef<View>(null);
  const api = useRef<BlockEditorApi | null>(null);
  const items = useSlashItems();
  // Os callbacks mais novos, sem remontar o editor
  const latest = useRef({ onChange, onBlur, onImage, today });
  useEffect(() => {
    latest.current = { onChange, onBlur, onImage, today };
  });

  useEffect(() => {
    const el = host.current as unknown as HTMLElement | null;
    if (!el) return;
    const mounted = mountBlockEditor(el, {
      markdown: value,
      editable,
      placeholder: t('notes.bodyPlaceholder'),
      plusLabel: t('blockEditor.plus'),
      onChange: (md) => latest.current.onChange(md),
      onBlur: () => latest.current.onBlur?.(),
      slash: {
        items,
        onExternal: (id) => {
          if (id === 'image') latest.current.onImage?.();
        },
        today: () => latest.current.today,
        queryTemplate: t('blockEditor.queryTemplate'),
        buttonTemplate: t('blockEditor.buttonTemplate'),
      },
    });
    api.current = mounted;
    if (apiRef) apiRef.current = mounted;
    return () => {
      mounted.destroy();
      api.current = null;
      if (apiRef) apiRef.current = null;
    };
    // Monta uma vez; o texto novo entra pelo setMarkdown abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.current?.setMarkdown(value);
  }, [value]);
  useEffect(() => {
    api.current?.setEditable(editable);
  }, [editable]);

  return <View ref={host} testID="block-editor" className="min-h-64 flex-1 pl-8" />;
}
