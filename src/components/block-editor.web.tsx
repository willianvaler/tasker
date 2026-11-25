import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useSlashItems } from '@/components/block-editor-items';
import { mountBlockEditor, type BlockEditorApi } from '@/lib/block-editor/mount';
import { texToSvg } from '@/lib/mathjax';
import { useLinkCandidates } from '@/lib/queries/links';
import { cleanLinkTitle, linkMarkup } from '@/lib/wikilinks';

// Editor de blocos na web (R1.1, D371): o TipTap montado direto na página. Recebe e devolve o
// Markdown da anotação (o que não foi mexido volta byte a byte, lib/block-editor/markdown.ts).

export const BLOCK_EDITOR = true;

export function BlockEditor({
  value,
  onChange,
  onBlur,
  editable,
  apiRef,
  onImage,
  today,
  exclude,
  onFail: _onFail,
}: {
  value: string;
  onChange: (md: string) => void;
  onBlur?: () => void;
  editable: boolean;
  apiRef?: MutableRefObject<BlockEditorApi | null>;
  onImage?: () => void;
  today: string;
  /** A própria anotação não aparece nas sugestões do [[ */
  exclude?: string;
  /** Só no celular (a WebView): o editor não abriu */
  onFail?: (message: string) => void;
}) {
  const { t } = useTranslation();
  // [[ (R1.3): o editor avisa o texto; o app busca e devolve as sugestões
  const [linkQuery, setLinkQuery] = useState<string | null>(null);
  const candidates = useLinkCandidates(linkQuery, exclude);
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
      onLinkQuery: setLinkQuery,
      renderMath: (tex, display) => texToSvg(tex, display).then((r) => r?.svg ?? null),
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

  const typed = (linkQuery ?? '').trim();
  const suggestions = [
    ...candidates.map((c) => ({
      key: `${c.kind}:${c.id}`,
      label: c.title,
      context: c.context,
      markup: linkMarkup(c.title, c.kind, c.id),
    })),
    ...(typed &&
    !candidates.some((c) => c.kind === 'note' && c.title.toLowerCase() === typed.toLowerCase())
      ? [
          {
            key: 'new',
            label: t('wikilinks.newLink', { title: cleanLinkTitle(typed) }),
            context: null,
            markup: `[[${cleanLinkTitle(typed)}]]`,
          },
        ]
      : []),
  ];
  const suggestionKey = linkQuery === null ? '' : suggestions.map((x) => x.key).join(',');
  useEffect(() => {
    api.current?.setLinkSuggestions(linkQuery === null ? [] : suggestions);
    // A lista muda quando as chaves mudam
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestionKey]);
  useEffect(() => {
    api.current?.setEditable(editable);
  }, [editable]);

  return <View ref={host} testID="block-editor" className="min-h-64 flex-1 pl-8" />;
}
