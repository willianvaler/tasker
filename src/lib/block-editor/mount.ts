import { Editor } from '@tiptap/core';

import { LinkSuggest, setLinkSuggestions, type LinkSuggestion } from './link';
import { MathPreview, type RenderMath } from './math';
import { docToMarkdown, markdownToDoc } from './markdown';
import { editorExtensions, setCalloutLabels } from './schema';
import { openSlashAfter, SlashMenu, type SlashOptions } from './slash';

// Monta o editor de blocos (R1, D370, D371) num elemento: a web usa direto (block-editor.web.tsx) e a
// WebView do celular usa empacotado. Só DOM; os textos vêm de quem monta.

export type BlockEditorApi = {
  getMarkdown(): string;
  /** Troca o texto inteiro (outro aparelho gravou, imagem inserida pelo app) */
  setMarkdown(md: string): void;
  focus(): void;
  format(kind: FormatKind): void;
  insertText(text: string): void;
  setEditable(editable: boolean): void;
  /** As sugestões do `[[` (o que o app achou para o texto que `onLinkQuery` avisou) */
  setLinkSuggestions(items: LinkSuggestion[]): void;
  /** Abre o menu `/` numa linha nova depois do bloco do cursor (o botão Inserir da barra) */
  openMenu(): void;
  /** Rola até o cursor (o teclado do celular encolheu a tela) */
  scrollToCursor(): void;
  /** Onde está o cursor na tela (para fugir do teclado do celular) */
  caretRect(): { top: number; bottom: number } | null;
  destroy(): void;
};

export type FormatKind = 'bold' | 'italic' | 'heading' | 'bullet' | 'ordered' | 'task' | 'highlight';

export type MountOptions = {
  markdown: string;
  editable: boolean;
  placeholder: string;
  plusLabel: string;
  /** Nome de cada tipo de callout (`tip` → "Dica") */
  calloutLabels?: Record<string, string>;
  slash: SlashOptions;
  /** Chamado com o Markdown novo, no máximo a cada `throttleMs` (e ao sair do campo) */
  onChange: (md: string) => void;
  onBlur?: () => void;
  /** O que se digitou depois do `[[` (null quando a lista fecha) */
  onLinkQuery?: (query: string | null) => void;
  /** Desenha a fórmula (o MathJax do app); sem ele, a fórmula fica só como texto */
  renderMath?: RenderMath;
  throttleMs?: number;
};

export const EDITOR_CSS = `
.ql-editor { outline: none; min-height: 16rem; padding: 12px 0 40vh; color: rgb(var(--ink)); font-size: 16px; line-height: 1.6; }
.ql-editor > * { margin: 0 0 .45em; position: relative; }
.ql-editor[data-empty="true"]::before { content: attr(data-placeholder); color: rgb(var(--ink-muted)); position: absolute; pointer-events: none; }
.ql-editor h1 { font-size: 1.7em; font-family: Georgia, serif; margin-top: .8em; }
.ql-editor h2 { font-size: 1.35em; font-family: Georgia, serif; margin-top: .7em; }
.ql-editor h3 { font-size: 1.15em; margin-top: .6em; }
.ql-editor ul, .ql-editor ol { padding-left: 1.4em; }
.ql-editor ul[data-type="taskList"] { list-style: none; padding-left: .2em; }
.ql-editor ul[data-type="taskList"] li { display: flex; gap: .5em; align-items: flex-start; }
.ql-editor ul[data-type="taskList"] li > label { margin-top: .25em; }
.ql-editor ul[data-type="taskList"] li[data-checked="true"] > div { color: rgb(var(--ink-muted)); text-decoration: line-through; }
.ql-editor blockquote { border-left: 3px solid rgb(var(--line)); padding-left: .9em; color: rgb(var(--ink-muted)); }
.ql-editor pre { background: rgb(var(--wash)); border-radius: 8px; padding: .7em .9em; font-family: ui-monospace, monospace; font-size: .9em; white-space: pre-wrap; }
.ql-editor code { background: rgb(var(--wash)); border-radius: 4px; padding: .1em .3em; font-family: ui-monospace, monospace; font-size: .9em; }
.ql-editor pre code { background: none; padding: 0; }
.ql-editor mark { background: rgb(var(--accent-soft)); color: inherit; border-radius: 3px; padding: 0 .1em; }
.ql-editor a { color: rgb(var(--accent)); text-decoration: underline; }
.ql-editor hr { border: none; border-top: 1px solid rgb(var(--line)); margin: 1em 0; }
.ql-editor table { border-collapse: collapse; width: 100%; table-layout: fixed; }
.ql-editor td, .ql-editor th { border: 1px solid rgb(var(--line)); padding: .3em .5em; vertical-align: top; }
.ql-editor th { background: rgb(var(--wash)); font-weight: 600; text-align: left; }
.ql-editor td p, .ql-editor th p { margin: 0; }
.ql-editor .selectedCell { background: rgb(var(--accent-soft)); }
.ql-editor .ql-callout { border: 1px solid rgb(var(--line)); border-left: 4px solid rgb(var(--accent)); border-radius: 8px; padding: .5em .8em; background: rgb(var(--surface)); }
.ql-editor .ql-callout::before { content: attr(data-title); display: block; font-weight: 600; font-size: .85em; text-transform: capitalize; color: rgb(var(--accent)); }
.ql-editor .ql-callout[data-callout="warning"], .ql-editor .ql-callout[data-callout="danger"] { border-left-color: rgb(var(--danger)); }
.ql-editor .ql-raw pre { border: 1px dashed rgb(var(--line)); background: rgb(var(--surface)); }
.ql-editor .ql-raw::before { display: block; font-size: .75em; text-transform: uppercase; letter-spacing: .05em; color: rgb(var(--ink-muted)); margin-bottom: .2em; }
.ql-editor .ql-raw[data-raw="formula"]::before { content: "∑ " var(--ql-formula, "Fórmula"); }
.ql-editor .ql-raw[data-raw="consulta"]::before { content: "▦ " var(--ql-query, "Consulta"); }
.ql-editor .ql-raw[data-raw="botao"]::before { content: "▶ " var(--ql-button, "Botão"); }
.ql-editor .ql-raw[data-raw="incorporar"]::before { content: "↳ " var(--ql-embed, "Incorporar"); }
.ql-editor .ql-math-preview { padding: .5em 0 .2em; text-align: center; color: rgb(var(--ink)); overflow-x: auto; }
.ql-editor .ql-inline-formula svg { vertical-align: middle; }
.ql-editor .ql-inline { border-radius: 4px; padding: 0 .25em; white-space: nowrap; }
.ql-editor .ql-inline-link { color: rgb(var(--accent)); background: rgb(var(--accent-soft)); }
.ql-editor .ql-inline-formula { font-family: ui-monospace, monospace; background: rgb(var(--wash)); }
.ql-editor .ql-inline-etiqueta { color: rgb(var(--accent)); }
.ql-editor .ql-inline-id, .ql-editor .ql-inline-rodape { color: rgb(var(--ink-muted)); font-size: .8em; }
.ql-editor .ql-inline-imagem { background: rgb(var(--wash)); }
.ql-editor .ProseMirror-selectednode { outline: 2px solid rgb(var(--accent)); border-radius: 4px; }
.ql-plus { position: absolute; width: 24px; height: 24px; border-radius: 6px; border: none; background: transparent; color: rgb(var(--ink-muted)); font-size: 18px; line-height: 22px; cursor: pointer; display: none; }
.ql-plus:hover { background: rgb(var(--wash)); color: rgb(var(--ink)); }
.ql-slash { position: absolute; z-index: 1000; width: 290px; max-height: 300px; overflow-y: auto; background: rgb(var(--surface)); border: 1px solid rgb(var(--line)); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,.18); padding: 4px; font-family: system-ui, sans-serif; }
.ql-slash-item { display: flex; flex-direction: column; padding: 6px 10px; border-radius: 6px; cursor: pointer; color: rgb(var(--ink)); }
.ql-slash-item span { font-size: 12px; color: rgb(var(--ink-muted)); }
.ql-slash-item.is-active, .ql-slash-item:hover { background: rgb(var(--wash)); }
`;

function injectCss() {
  if (document.getElementById('ql-editor-css')) return;
  const style = document.createElement('style');
  style.id = 'ql-editor-css';
  style.textContent = EDITOR_CSS;
  document.head.appendChild(style);
}

export function mountBlockEditor(host: HTMLElement, o: MountOptions): BlockEditorApi {
  injectCss();
  setCalloutLabels(o.calloutLabels);
  host.style.position = 'relative';
  let loaded = markdownToDoc(o.markdown);
  let last = o.markdown;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const emit = () => {
    timer = null;
    const md = docToMarkdown(editor.state.doc, loaded.tail);
    if (md === last) return;
    last = md;
    o.onChange(md);
  };

  const editor = new Editor({
    element: host,
    extensions: editorExtensions([
      SlashMenu.configure(o.slash),
      LinkSuggest.configure({ onQuery: (q) => o.onLinkQuery?.(q) }),
      MathPreview.configure({ render: o.renderMath ?? null }),
    ]),
    content: loaded.doc,
    editable: o.editable,
    editorProps: {
      // O placeholder fica na raiz, pelos atributos que o próprio ProseMirror atualiza (mexer num
      // nó de dentro faz o observador de DOM dele reler o documento e embaralhar a digitação)
      attributes: (state) => {
        const first = state.doc.firstChild;
        const empty =
          state.doc.childCount === 1 && !!first?.isTextblock && first.content.size === 0;
        return {
          class: 'ql-editor',
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': o.placeholder,
          spellcheck: 'true',
          'data-placeholder': o.placeholder,
          'data-empty': String(empty),
        };
      },
    },
    onUpdate: () => {
      if (!timer) timer = setTimeout(emit, o.throttleMs ?? 250);
    },
    onBlur: () => {
      if (timer) clearTimeout(timer);
      emit();
      o.onBlur?.();
    },
  });

  // Botão + ao lado do bloco sob o mouse: abre o menu numa linha nova depois dele
  const plus = document.createElement('button');
  plus.type = 'button';
  plus.className = 'ql-plus';
  plus.textContent = '+';
  plus.setAttribute('aria-label', o.plusLabel);
  plus.title = o.plusLabel;
  host.appendChild(plus);
  let plusPos = -1;
  const onMove = (e: MouseEvent) => {
    if (!editor.isEditable) return;
    const root = editor.view.dom;
    let el = e.target as HTMLElement | null;
    while (el && el.parentElement !== root) el = el.parentElement;
    if (!el || el === plus) return;
    const pos = editor.view.posAtDOM(el, 0);
    const $pos = editor.state.doc.resolve(Math.max(0, Math.min(pos, editor.state.doc.content.size)));
    plusPos = $pos.depth > 0 ? $pos.before(1) : pos;
    const hostBox = host.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    plus.style.display = 'block';
    plus.style.top = `${box.top - hostBox.top + 2}px`;
    plus.style.left = `${Math.max(-30, box.left - hostBox.left - 30)}px`;
  };
  host.addEventListener('mousemove', onMove);
  plus.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (plusPos >= 0) openSlashAfter(editor, plusPos);
  });

  return {
    getMarkdown: () => {
      if (timer) {
        clearTimeout(timer);
        emit();
      }
      return last;
    },
    setMarkdown: (md) => {
      if (md === last) return;
      loaded = markdownToDoc(md);
      last = md;
      editor.commands.setContent(loaded.doc, { emitUpdate: false });
    },
    focus: () => editor.commands.focus(),
    format: (kind) => {
      const c = editor.chain().focus();
      if (kind === 'bold') c.toggleBold().run();
      else if (kind === 'italic') c.toggleItalic().run();
      else if (kind === 'highlight') c.toggleHighlight().run();
      else if (kind === 'heading') c.toggleHeading({ level: 2 }).run();
      else if (kind === 'bullet') c.toggleBulletList().run();
      else if (kind === 'ordered') c.toggleOrderedList().run();
      else c.toggleTaskList().run();
    },
    insertText: (text) => editor.chain().focus().insertContent(text).run(),
    setEditable: (editable) => editor.setEditable(editable),
    setLinkSuggestions: (items) => setLinkSuggestions(editor, items),
    caretRect: () => {
      if (!editor.isFocused) return null;
      try {
        const c = editor.view.coordsAtPos(editor.state.selection.head);
        return { top: c.top, bottom: c.bottom };
      } catch {
        return null;
      }
    },
    scrollToCursor: () => {
      if (editor.isFocused) editor.commands.scrollIntoView();
    },
    openMenu: () => {
      const { $from } = editor.state.selection;
      const pos = $from.depth > 0 ? $from.before(1) : 0;
      openSlashAfter(editor, Math.min(pos, Math.max(0, editor.state.doc.content.size - 1)));
    },
    destroy: () => {
      if (timer) {
        clearTimeout(timer);
        emit();
      }
      host.removeEventListener('mousemove', onMove);
      plus.remove();
      editor.destroy();
    },
  };
}
