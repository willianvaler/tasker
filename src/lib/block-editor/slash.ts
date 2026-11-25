import { Extension, type Editor, type Range } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';

// Menu `/` e botão `+` do editor de blocos (R1.2, D371). Só DOM, sem React: o mesmo código roda na
// web e na WebView do celular. Os textos vêm de quem monta o editor (i18n do app).

export type SlashItem = {
  id: SlashId;
  label: string;
  hint: string;
  /** Outras palavras para achar (nos 3 idiomas, sem acento) */
  keywords: string;
};

export type SlashId =
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'ordered'
  | 'task'
  | 'quote'
  | 'callout'
  | 'code'
  | 'table'
  | 'divider'
  | 'formula'
  | 'query'
  | 'button'
  | 'link'
  | 'embed'
  | 'image'
  | 'today';

export type SlashOptions = {
  items: SlashItem[];
  /** O que não é do editor (imagem: o seletor de arquivos do app) */
  onExternal: (id: SlashId) => void;
  today: () => string;
  queryTemplate: string;
  buttonTemplate: string;
};

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Os itens que batem com o que se digitou depois da barra */
export function filterSlash(items: SlashItem[], query: string): SlashItem[] {
  const q = fold(query.trim());
  if (!q) return items;
  return items.filter((i) => fold(`${i.label} ${i.keywords} ${i.id}`).includes(q));
}

const raw = (kind: string, text: string) => ({
  type: 'rawBlock',
  attrs: { kind },
  content: text ? [{ type: 'text', text }] : [],
});

/** Volta o cursor `n` caracteres (para cair dentro do que acabou de entrar) */
const back =
  (n: number) =>
  ({ tr }: { tr: import('@tiptap/pm/state').Transaction }) => {
    const pos = Math.max(0, tr.selection.from - n);
    tr.setSelection(TextSelection.create(tr.doc, pos));
    return true;
  };

/** Aplica o item escolhido no lugar de `range` (o `/texto` digitado) */
export function runSlash(editor: Editor, range: Range, id: SlashId, o: SlashOptions) {
  const chain = editor.chain().focus().deleteRange(range);
  switch (id) {
    case 'text':
      return chain.setParagraph().run();
    case 'h1':
    case 'h2':
    case 'h3':
      return chain.setHeading({ level: Number(id[1]) as 1 | 2 | 3 }).run();
    case 'bullet':
      return chain.toggleBulletList().run();
    case 'ordered':
      return chain.toggleOrderedList().run();
    case 'task':
      return chain.toggleTaskList().run();
    case 'quote':
      return chain.toggleBlockquote().run();
    case 'callout':
      return chain
        .insertContent({
          type: 'callout',
          attrs: { kind: 'tip', title: '', fold: '' },
          content: [{ type: 'paragraph' }],
        })
        .run();
    case 'code':
      return chain.toggleCodeBlock().run();
    case 'table':
      return chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    case 'divider':
      return chain.setHorizontalRule().run();
    case 'formula':
      // O cursor fica na linha do meio, entre os $$
      return chain.insertContent(raw('formula', '$$\n\n$$')).command(back(3)).run();
    case 'query':
      return chain.insertContent(raw('consulta', `\`\`\`questlist\n${o.queryTemplate}\n\`\`\``)).run();
    case 'button':
      return chain.insertContent(raw('botao', `\`\`\`questlist-button\n${o.buttonTemplate}\n\`\`\``)).run();
    case 'link':
      return chain.insertContent('[[').run();
    case 'embed':
      return chain.insertContent(raw('incorporar', '![[]]')).command(back(2)).run();
    case 'today':
      return chain.insertContent(o.today()).run();
    case 'image':
      chain.run();
      return o.onExternal('image');
  }
}

type MenuState = { range: Range; query: string } | null;

const key = new PluginKey<MenuState>('qlSlash');

/** O `/` no começo da linha ou depois de um espaço, até o cursor */
function findSlash(editor: Editor): MenuState {
  const { state } = editor;
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.type.spec.code) return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
  const m = /(^|\s)\/([\p{L}\p{N}-]+(?: [\p{L}\p{N}-]+)?|)$/u.exec(before);
  if (!m) return null;
  const from = $from.pos - m[2].length - 1;
  return { range: { from, to: $from.pos }, query: m[2] };
}

/**
 * A linha foi quebrada logo depois do `/consulta` (o cursor está numa linha vazia nova e a de cima
 * termina com o comando): onde está a linha vazia e onde termina o comando.
 */
export function splitAfterSlash(
  editor: Editor,
  query: string,
): { emptyFrom: number; emptyTo: number; end: number } | null {
  const { $from, empty } = editor.state.selection;
  if (!empty || $from.parent.content.size !== 0 || $from.depth < 1) return null;
  const index = $from.index($from.depth - 1);
  if (index === 0) return null;
  const container = $from.node($from.depth - 1);
  const prev = container.child(index - 1);
  if (!prev.isTextblock) return null;
  const text = prev.textContent;
  if (!text.endsWith(`/${query}`) || !/(^|\s)$/.test(text.slice(0, text.length - query.length - 1)))
    return null;
  const emptyFrom = $from.before();
  return { emptyFrom, emptyTo: $from.after(), end: emptyFrom - 1 };
}

export const SlashMenu = Extension.create<SlashOptions>({
  name: 'qlSlash',
  addOptions() {
    return {
      items: [],
      onExternal: () => undefined,
      today: () => new Date().toISOString().slice(0, 10),
      queryTemplate: '',
      buttonTemplate: '',
    };
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    const options = this.options;
    let menu: HTMLDivElement | null = null;
    let active = 0;
    let shown: SlashItem[] = [];
    let current: MenuState = null;

    const close = () => {
      menu?.remove();
      menu = null;
      current = null;
    };
    const choose = (item: SlashItem | undefined) => {
      if (!item || !current) return close();
      const range = current.range;
      close();
      runSlash(editor, range, item.id, options);
    };
    const render = () => {
      if (!current) return close();
      shown = filterSlash(options.items, current.query);
      if (shown.length === 0) return close();
      active = Math.min(active, shown.length - 1);
      if (!menu) {
        menu = document.createElement('div');
        menu.className = 'ql-slash';
        menu.setAttribute('role', 'listbox');
        document.body.appendChild(menu);
      }
      menu.innerHTML = '';
      shown.forEach((item, i) => {
        const el = document.createElement('div');
        el.className = `ql-slash-item${i === active ? ' is-active' : ''}`;
        el.setAttribute('role', 'option');
        el.setAttribute('aria-selected', String(i === active));
        el.innerHTML = '<strong></strong><span></span>';
        (el.firstChild as HTMLElement).textContent = item.label;
        (el.lastChild as HTMLElement).textContent = item.hint;
        // pointerdown: vale para o dedo e para o mouse, e não tira o foco do editor
        el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          choose(item);
        });
        menu?.appendChild(el);
      });
      const coords = editor.view.coordsAtPos(current.range.from);
      const top = Math.min(coords.bottom + 4, window.innerHeight - 320);
      menu.style.left = `${Math.max(8, Math.min(coords.left, window.innerWidth - 300))}px`;
      menu.style.top = `${Math.max(8, top) + window.scrollY}px`;
      menu.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
    };

    return [
      new Plugin({
        key,
        view: () => ({
          update: () => {
            // O Enter do teclado do celular durante a composição da palavra não chega como tecla:
            // ele quebra a linha. Com o menu aberto, desfaz a quebra e aplica o item escolhido
            // (a quebra pode chegar em duas transações: o texto e, depois, só o cursor)
            if (menu && current) {
              const split = splitAfterSlash(editor, current.query);
              if (split) {
                const item = shown[active];
                const query = current.query;
                close();
                editor
                  .chain()
                  .command(({ tr }) => {
                    tr.delete(split.emptyFrom, split.emptyTo);
                    tr.setSelection(TextSelection.create(tr.doc, split.end));
                    return true;
                  })
                  .run();
                if (item)
                  runSlash(editor, { from: split.end - query.length - 1, to: split.end }, item.id, options);
                return;
              }
            }
            const found = editor.isEditable ? findSlash(editor) : null;
            if (!found) return close();
            if (!current || current.query !== found.query) active = 0;
            current = found;
            render();
          },
          destroy: close,
        }),
        props: {
          handleKeyDown: (_view, event) => {
            if (!menu || !current) return false;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              active = (active + (event.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length;
              render();
              return true;
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
              choose(shown[active]);
              return true;
            }
            if (event.key === 'Escape') {
              close();
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});

/** Abre o menu no bloco: põe uma linha nova depois dele com a barra (o botão `+`) */
export function openSlashAfter(editor: Editor, pos: number) {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return;
  const after = pos + node.nodeSize;
  editor
    .chain()
    .focus()
    .insertContentAt(after, { type: 'paragraph', content: [{ type: 'text', text: '/' }] })
    .setTextSelection(after + 2)
    .run();
}
