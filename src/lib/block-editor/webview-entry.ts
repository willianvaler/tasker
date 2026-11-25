import type { LinkSuggestion } from './link';
import { mountBlockEditor, type BlockEditorApi, type FormatKind } from './mount';
import type { SlashItem } from './slash';

// O editor de blocos dentro da WebView do celular (R1.4, D373). Empacotado pelo
// scripts/editor-webview.mjs em assets/editor/editor.txt. Conversa com o app por mensagens:
// o app manda `init` e os comandos; o editor devolve o texto (`change`), o `[[` (`link`), o pedido de
// imagem e o de desenhar fórmula (o MathJax roda no app, D323).

type InitMessage = {
  type: 'init';
  markdown: string;
  editable: boolean;
  placeholder: string;
  plusLabel: string;
  items: SlashItem[];
  today: string;
  queryTemplate: string;
  buttonTemplate: string;
};

type Incoming =
  | InitMessage
  | { type: 'set'; markdown: string }
  | { type: 'format'; kind: FormatKind }
  | { type: 'insert'; text: string }
  | { type: 'editable'; editable: boolean }
  | { type: 'links'; items: LinkSuggestion[] }
  | { type: 'math'; id: number; svg: string | null }
  | { type: 'flush' }
  | { type: 'menu' }
  | { type: 'focus' };

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(data: string): void };
    __ql?: { receive(msg: Incoming): void };
  }
}

const post = (msg: object) => window.ReactNativeWebView?.postMessage(JSON.stringify(msg));

let api: BlockEditorApi | null = null;
let nextMath = 1;
const waitingMath = new Map<number, (svg: string | null) => void>();

function init(m: InitMessage) {
  api?.destroy();
  const host = document.getElementById('editor');
  if (!host) return;
  api = mountBlockEditor(host, {
    markdown: m.markdown,
    editable: m.editable,
    placeholder: m.placeholder,
    plusLabel: m.plusLabel,
    throttleMs: 300,
    onChange: (md) => post({ type: 'change', markdown: md }),
    onBlur: () => post({ type: 'blur' }),
    onLinkQuery: (q) => post({ type: 'link', query: q }),
    renderMath: (tex, display) =>
      new Promise((resolve) => {
        const id = nextMath++;
        waitingMath.set(id, resolve);
        post({ type: 'math', id, tex, display });
      }),
    slash: {
      items: m.items,
      onExternal: (id) => post({ type: 'external', id }),
      today: () => m.today,
      queryTemplate: m.queryTemplate,
      buttonTemplate: m.buttonTemplate,
    },
  });
}

window.__ql = {
  receive(msg) {
    switch (msg.type) {
      case 'init':
        return init(msg);
      case 'set':
        return api?.setMarkdown(msg.markdown);
      case 'format':
        return api?.format(msg.kind);
      case 'insert':
        return api?.insertText(msg.text);
      case 'editable':
        return api?.setEditable(msg.editable);
      case 'links':
        return api?.setLinkSuggestions(msg.items);
      case 'focus':
        return api?.focus();
      case 'menu':
        return api?.openMenu();
      case 'flush': {
        const md = api?.getMarkdown();
        if (md !== undefined) post({ type: 'change', markdown: md });
        return;
      }
      case 'math': {
        const done = waitingMath.get(msg.id);
        waitingMath.delete(msg.id);
        done?.(msg.svg);
        return;
      }
    }
  },
};

window.addEventListener('error', (e) => post({ type: 'error', message: String(e.message) }));
post({ type: 'ready' });
