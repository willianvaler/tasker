import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, Keyboard, View } from 'react-native';
import { WebView } from 'react-native-webview';

import editorBundle from '../../assets/editor/editor.txt';

import { calloutLabels, useSlashItems } from '@/components/block-editor-items';
import type { BlockEditorApi } from '@/lib/block-editor/mount';
import { editorPageHtml, parseEditorMessage } from '@/lib/block-editor/webview-html';
import { texToSvg } from '@/lib/mathjax';
import { useLinkCandidates } from '@/lib/queries/links';
import { useColors } from '@/lib/tokens';
import { cleanLinkTitle, linkMarkup } from '@/lib/wikilinks';

// Editor de blocos no celular (R1.4, D373): o mesmo núcleo da web (lib/block-editor) numa WebView,
// empacotado em assets/editor/editor.txt. O app manda o texto e os comandos por mensagem e recebe o
// Markdown de volta; o `[[` e as fórmulas são resolvidos aqui (a busca e o MathJax são do app).

export const BLOCK_EDITOR = true;

/** Copia o pacote para o cache (de novo só quando o hash muda) e escreve a página com as cores */
async function editorPage(html: (script: string) => string, scheme: string) {
  const dir = new Directory(Paths.cache, 'block-editor');
  if (!dir.exists) dir.create({ idempotent: true });
  const asset = Asset.fromModule(editorBundle);
  const version = asset.hash ?? asset.name;
  const script = new File(dir, 'editor.js');
  const marker = new File(dir, 'version.txt');
  if (!(marker.exists && marker.textSync() === version && script.exists)) {
    await asset.downloadAsync();
    if (!asset.localUri) throw new Error('editor');
    if (script.exists) script.delete();
    new File(asset.localUri).copy(script);
    if (marker.exists) marker.delete();
    marker.create();
    marker.write(version);
  }
  const page = new File(dir, `editor-${scheme}.html`);
  if (page.exists) page.delete();
  page.create();
  page.write(html('editor.js'));
  return page.uri;
}

export function BlockEditor({
  value,
  onChange,
  onBlur,
  editable,
  apiRef,
  onImage,
  today,
  exclude,
  onFail,
}: {
  value: string;
  onChange: (md: string) => void;
  onBlur?: () => void;
  editable: boolean;
  apiRef?: MutableRefObject<BlockEditorApi | null>;
  onImage?: () => void;
  today: string;
  exclude?: string;
  /** O editor não abriu (a tela volta ao campo de Markdown) */
  onFail?: (message: string) => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const items = useSlashItems();
  const web = useRef<WebView>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const last = useRef(value);
  const ready = useRef(false);
  const [linkQuery, setLinkQuery] = useState<string | null>(null);
  const candidates = useLinkCandidates(linkQuery, exclude);
  const scheme = colors.paper;

  const send = (msg: object) =>
    web.current?.injectJavaScript(`window.__ql && window.__ql.receive(${JSON.stringify(msg)}); true;`);

  useEffect(() => {
    let alive = true;
    editorPage(
      (script) =>
        editorPageHtml(
          {
            paper: colors.paper,
            surface: colors.surface,
            wash: colors.wash,
            ink: colors.ink,
            'ink-muted': colors['ink-muted'],
            line: colors.line,
            accent: colors.accent,
            'accent-soft': colors['accent-soft'],
            danger: colors.danger,
          },
          script,
        ),
      scheme.replace('#', ''),
    )
      .then((u) => alive && setUri(u))
      .catch((e: Error) => {
        if (!alive) return;
        setFailed(e.message);
        onFail?.(e.message);
      });
    return () => {
      alive = false;
    };
    // A página muda com o tema
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheme]);

  // A API que a tela usa (a mesma da web)
  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      getMarkdown: () => {
        send({ type: 'flush' });
        return last.current;
      },
      setMarkdown: (md) => {
        last.current = md;
        send({ type: 'set', markdown: md });
      },
      focus: () => send({ type: 'focus' }),
      format: (kind) => send({ type: 'format', kind }),
      insertText: (text) => send({ type: 'insert', text }),
      setEditable: (e) => send({ type: 'editable', editable: e }),
      setLinkSuggestions: (list) => send({ type: 'links', items: list }),
      openMenu: () => send({ type: 'menu' }),
      scrollToCursor: () => undefined,
      caretRect: () => null,
      destroy: () => undefined,
    };
    return () => {
      apiRef.current = null;
    };
  });

  // O teclado cobre o fim da WebView (ela não encolhe no Android): conta quanto e avisa a página
  const box = useRef<View>(null);
  useEffect(() => {
    const report = (kb: number) =>
      box.current?.measureInWindow((_x, y, _w, h) => {
        const screen = Dimensions.get('window').height;
        send({ type: 'keyboard', overlap: kb > 0 ? Math.max(0, y + h - (screen - kb)) : 0 });
      });
    const show = Keyboard.addListener('keyboardDidShow', (e) => report(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => report(0));
    return () => {
      show.remove();
      hide.remove();
    };
    // send lê a WebView pelo ref
  }, []);

  useEffect(() => {
    if (ready.current && value !== last.current) {
      last.current = value;
      send({ type: 'set', markdown: value });
    }
  }, [value]);
  useEffect(() => {
    if (ready.current) send({ type: 'editable', editable });
  }, [editable]);

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
    if (ready.current) send({ type: 'links', items: linkQuery === null ? [] : suggestions });
    // A lista muda quando as chaves mudam
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestionKey]);

  return (
    <View ref={box} className="min-h-64 flex-1">
      {uri && !failed && (
        <WebView
          ref={web}
          source={{ uri }}
          originWhitelist={['*']}
          allowFileAccess
          allowFileAccessFromFileURLs
          allowingReadAccessToURL={Paths.cache.uri}
          javaScriptEnabled
          keyboardDisplayRequiresUserAction={false}
          hideKeyboardAccessoryView
          setSupportMultipleWindows={false}
          style={{ flex: 1, minHeight: 320, backgroundColor: 'transparent' }}
          testID="block-editor-webview"
          onMessage={(e) => {
            const msg = parseEditorMessage(e.nativeEvent.data);
            if (!msg) return;
            switch (msg.type) {
              case 'ready':
                ready.current = true;
                send({
                  type: 'init',
                  markdown: last.current,
                  editable,
                  placeholder: t('blockEditor.placeholder'),
                  plusLabel: t('blockEditor.plus'),
                  calloutLabels: calloutLabels(t),
                  items,
                  today,
                  queryTemplate: t('blockEditor.queryTemplate'),
                  buttonTemplate: t('blockEditor.buttonTemplate'),
                });
                return;
              case 'change':
                last.current = msg.markdown;
                onChange(msg.markdown);
                return;
              case 'blur':
                onBlur?.();
                return;
              case 'link':
                setLinkQuery(msg.query);
                return;
              case 'external':
                if (msg.id === 'image') onImage?.();
                return;
              case 'math':
                void texToSvg(msg.tex, msg.display).then((r) =>
                  send({ type: 'math', id: msg.id, svg: r?.svg ?? null }),
                );
                return;
              case 'error':
                setFailed(msg.message);
                onFail?.(msg.message);
                return;
            }
          }}
        />
      )}
    </View>
  );
}
