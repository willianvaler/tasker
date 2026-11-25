// A página do editor de blocos na WebView do celular (R1.4, D373). Função pura: as cores do tema
// viram as variáveis CSS que o editor usa (as mesmas do global.css), e o script é o pacote copiado
// para o cache do app (assets/editor/editor.txt).

const hexToTriplet = (hex: string) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6);
  const n = Number.parseInt(full, 16);
  return Number.isNaN(n) ? '0 0 0' : `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

export type EditorColors = Record<
  'paper' | 'surface' | 'wash' | 'ink' | 'ink-muted' | 'line' | 'accent' | 'accent-soft' | 'danger',
  string
>;

export function editorPageHtml(colors: EditorColors, script: string): string {
  const vars = Object.entries(colors)
    .map(([k, v]) => `--${k}: ${hexToTriplet(v)};`)
    .join(' ');
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>:root{${vars}} html,body{margin:0;background:rgb(var(--paper));font-family:system-ui,sans-serif;-webkit-text-size-adjust:100%}
#editor{padding:0 14px 0 14px}.ql-plus{display:none!important}</style></head>
<body><div id="editor"></div><script src="${script}"></script></body></html>`;
}

export type EditorMessage =
  | { type: 'ready' }
  | { type: 'change'; markdown: string }
  | { type: 'blur' }
  | { type: 'link'; query: string | null }
  | { type: 'external'; id: string }
  | { type: 'math'; id: number; tex: string; display: boolean }
  | { type: 'error'; message: string };

/** Lê a mensagem da WebView; o que não for do editor vira null */
export function parseEditorMessage(data: string): EditorMessage | null {
  try {
    const m = JSON.parse(data) as { type?: unknown };
    return m && typeof m.type === 'string' ? (m as EditorMessage) : null;
  } catch {
    return null;
  }
}
