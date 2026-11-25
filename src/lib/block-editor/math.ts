import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';

// Prévia das fórmulas no editor de blocos (R1.3, D372): o bloco `$$…$$` continua texto (grava byte
// a byte) e ganha o desenho embaixo; o `$x$` na linha aparece desenhado. Quem desenha é o app (o
// MathJax em SVG, D323), passado em `render`; sem ele, fica só o texto.

export type RenderMath = (tex: string, display: boolean) => Promise<string | null>;

/** O LaTeX de dentro do bloco `$$ … $$` (com ou sem as linhas próprias) */
export const blockTex = (text: string) => text.replace(/^\s*\$\$\s*|\s*\$\$\s*$/g, '').trim();

function paint(target: HTMLElement, svg: string | null, fallback: string) {
  if (svg) target.innerHTML = svg;
  else target.textContent = fallback;
}

export const MathPreview = Extension.create<{ render: RenderMath | null }>({
  name: 'qlMath',
  addOptions() {
    return { render: null };
  },
  addProseMirrorPlugins() {
    const render = this.options.render;
    if (!render) return [];
    return [
      new Plugin({
        key: new PluginKey('qlMath'),
        props: {
          nodeViews: {
            rawBlock: (node) => {
              const dom = document.createElement('div');
              dom.className = 'ql-raw';
              dom.setAttribute('data-raw', node.attrs.kind as string);
              const pre = document.createElement('pre');
              pre.setAttribute('spellcheck', 'false');
              dom.appendChild(pre);
              let preview: HTMLDivElement | null = null;
              let last = '';
              const refresh = (n: PMNode) => {
                if (n.attrs.kind !== 'formula') return;
                const tex = blockTex(n.textContent);
                if (tex === last) return;
                last = tex;
                if (!preview) {
                  preview = document.createElement('div');
                  preview.className = 'ql-math-preview';
                  preview.contentEditable = 'false';
                  dom.appendChild(preview);
                }
                const target = preview;
                if (!tex) return void (target.textContent = '');
                void render(tex, true).then((svg) => {
                  if (last === tex) paint(target, svg, tex);
                });
              };
              refresh(node);
              return {
                dom,
                contentDOM: pre,
                update: (n) => {
                  if (n.type !== node.type || n.attrs.kind !== node.attrs.kind) return false;
                  refresh(n);
                  return true;
                },
                // O desenho não é conteúdo: mudanças nele não são edição
                ignoreMutation: (m) => !!preview && preview.contains(m.target as globalThis.Node),
              };
            },
            rawInline: (node) => {
              const dom = document.createElement('span');
              const kind = node.attrs.kind as string;
              const text = node.attrs.text as string;
              dom.className = `ql-inline ql-inline-${kind}`;
              dom.title = text;
              dom.setAttribute('data-raw-inline', kind);
              dom.setAttribute('data-text', text);
              if (kind === 'formula') {
                const tex = text.replace(/^\$|\$$/g, '');
                dom.textContent = tex;
                void render(tex, false).then((svg) => paint(dom, svg, tex));
              } else {
                return null as unknown as { dom: HTMLElement };
              }
              return { dom };
            },
          },
        },
      }),
    ];
  },
});
