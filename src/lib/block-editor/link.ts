import { Extension, type Editor, type Range } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

// `[[` com sugestões no editor de blocos (R1.3, D372). O editor avisa o que se digitou depois do `[[`
// (`onQuery`); quem monta busca as anotações, tarefas e listas (o mesmo `useLinkCandidates` do campo
// de texto) e devolve as sugestões por `setLinkSuggestions`. Escolher troca o `[[texto` pelo link
// (`[[Título|n:<id>]]`), que aparece como o nome.

export type LinkSuggestion = { key: string; label: string; context: string | null; markup: string };

type Found = { range: Range; query: string } | null;

const key = new PluginKey('qlLink');

function findLink(editor: Editor): Found {
  const { $from, empty } = editor.state.selection;
  if (!empty || $from.parent.type.spec.code) return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
  const m = /\[\[([^[\]\n|]{0,60})$/.exec(before);
  if (!m) return null;
  return { range: { from: $from.pos - m[0].length, to: $from.pos }, query: m[1] };
}

export type LinkStorage = {
  items: LinkSuggestion[];
  rerender: () => void;
};

export const LinkSuggest = Extension.create<
  { onQuery: (query: string | null) => void },
  LinkStorage
>({
  name: 'qlLink',
  addOptions() {
    return { onQuery: () => undefined };
  },
  addStorage() {
    return { items: [], rerender: () => undefined };
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    const options = this.options;
    const storage = this.storage;
    let menu: HTMLDivElement | null = null;
    let current: Found = null;
    let active = 0;
    let lastQuery: string | null = null;

    const close = () => {
      menu?.remove();
      menu = null;
      current = null;
      if (lastQuery !== null) {
        lastQuery = null;
        options.onQuery(null);
      }
    };
    const choose = (item: LinkSuggestion | undefined) => {
      if (!item || !current) return close();
      const range = current.range;
      close();
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent([
          { type: 'rawInline', attrs: { kind: 'link', text: item.markup } },
          { type: 'text', text: ' ' },
        ])
        .run();
    };
    const render = () => {
      if (!current) return;
      const items = storage.items;
      if (items.length === 0) {
        menu?.remove();
        menu = null;
        return;
      }
      active = Math.min(active, items.length - 1);
      if (!menu) {
        menu = document.createElement('div');
        menu.className = 'ql-slash ql-link-menu';
        menu.setAttribute('role', 'listbox');
        document.body.appendChild(menu);
      }
      menu.innerHTML = '';
      items.forEach((item, i) => {
        const el = document.createElement('div');
        el.className = `ql-slash-item${i === active ? ' is-active' : ''}`;
        el.setAttribute('role', 'option');
        el.setAttribute('aria-selected', String(i === active));
        el.innerHTML = '<strong></strong><span></span>';
        (el.firstChild as HTMLElement).textContent = item.label;
        (el.lastChild as HTMLElement).textContent = item.context ?? '';
        el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          choose(item);
        });
        menu?.appendChild(el);
      });
      const coords = editor.view.coordsAtPos(current.range.from);
      menu.style.left = `${Math.max(8, Math.min(coords.left, window.innerWidth - 300))}px`;
      menu.style.top = `${Math.max(8, Math.min(coords.bottom + 4, window.innerHeight - 320)) + window.scrollY}px`;
    };
    storage.rerender = render;

    return [
      new Plugin({
        key,
        view: () => ({
          update: () => {
            const found = editor.isEditable ? findLink(editor) : null;
            if (!found) return close();
            if (!current || current.query !== found.query) active = 0;
            current = found;
            if (found.query !== lastQuery) {
              lastQuery = found.query;
              options.onQuery(found.query);
            }
            render();
          },
          destroy: close,
        }),
        props: {
          handleKeyDown: (_view, event) => {
            if (!menu || !current) return false;
            const n = storage.items.length;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              active = (active + (event.key === 'ArrowDown' ? 1 : -1) + n) % n;
              render();
              return true;
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
              choose(storage.items[active]);
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

export function setLinkSuggestions(editor: Editor, items: LinkSuggestion[]) {
  const storage = (editor.storage as unknown as { qlLink?: LinkStorage }).qlLink;
  if (!storage) return;
  storage.items = items;
  storage.rerender();
}
