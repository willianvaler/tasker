import { Extension, Node, mergeAttributes, type AnyExtension } from '@tiptap/core';
import { Highlight } from '@tiptap/extension-highlight';
import { TableKit } from '@tiptap/extension-table';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';
import { StarterKit } from '@tiptap/starter-kit';

// Editor de blocos (R1, D370): o esquema do TipTap usado na web e, empacotado, na WebView do
// celular. Não depende de React nem do DOM para montar o esquema (os testes rodam no Node).
//
// Cada bloco de primeiro nível guarda o texto original (`src`), o que o separava do anterior
// (`gap`) e uma impressão do conteúdo ao abrir (`orig`): ao salvar, o bloco que não mudou devolve o
// `src` exato e só o mexido é escrito de novo (lib/block-editor/markdown.ts).

/** Os blocos de primeiro nível que guardam o texto original */
export const TOP_BLOCKS = [
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'taskList',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'table',
  'callout',
  'rawBlock',
] as const;

const SourceAttrs = Extension.create({
  name: 'sourceAttrs',
  addGlobalAttributes() {
    const attr = { default: null, keepOnSplit: false, rendered: false };
    return [{ types: [...TOP_BLOCKS], attributes: { src: attr, orig: attr, gap: attr } }];
  },
});

/** Tipos de bloco cru: o que o editor mostra como texto, sem converter */
export type RawKind =
  | 'formula'
  | 'consulta'
  | 'botao'
  | 'incorporar'
  | 'propriedades'
  | 'outro';

/**
 * Bloco cru: fórmula, consulta, botão, incorporar e tudo que o editor não conhece. Edita como texto
 * (como um bloco de código) e grava byte a byte.
 */
export const RawBlock = Node.create({
  name: 'rawBlock',
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,
  addAttributes() {
    return { kind: { default: 'outro' as RawKind } };
  },
  parseHTML() {
    return [{ tag: 'div[data-raw]', preserveWhitespace: 'full' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-raw': node.attrs.kind, class: 'ql-raw' }),
      ['pre', { spellcheck: 'false' }, 0],
    ];
  },
});

/** Callout `> [!tipo]+ Título`: uma caixa com blocos dentro */
/** Nomes dos tipos de callout no idioma do app (M7: o editor dizia "Tip" e a leitura, "Dica") */
let calloutLabels: Record<string, string> = {};
export function setCalloutLabels(labels: Record<string, string> | undefined) {
  calloutLabels = labels ?? {};
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      kind: { default: 'note' },
      title: { default: '' },
      fold: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-callout': node.attrs.kind,
        'data-title': node.attrs.title || calloutLabels[String(node.attrs.kind).toLowerCase()] || node.attrs.kind,
        class: 'ql-callout',
      }),
      0,
    ];
  },
});

/** Tipos de trecho cru na linha: link `[[…]]`, fórmula `$…$`, imagem, etiqueta, rodapé, `^id` */
export type RawInlineKind = 'link' | 'formula' | 'imagem' | 'etiqueta' | 'rodape' | 'id';

/**
 * Trecho cru dentro da linha: aparece como uma etiqueta (o título do link, a fórmula, a imagem) e
 * grava o texto exato. Apagar apaga inteiro.
 */
export const RawInline = Node.create({
  name: 'rawInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { text: { default: '' }, kind: { default: 'link' as RawInlineKind } };
  },
  parseHTML() {
    return [
      {
        tag: 'span[data-raw-inline]',
        getAttrs: (el) => ({
          text: (el as HTMLElement).getAttribute('data-text') ?? '',
          kind: (el as HTMLElement).getAttribute('data-raw-inline') ?? 'link',
        }),
      },
    ];
  },
  renderHTML({ node }) {
    return [
      'span',
      {
        'data-raw-inline': node.attrs.kind,
        'data-text': node.attrs.text,
        class: `ql-inline ql-inline-${node.attrs.kind}`,
        title: node.attrs.text,
      },
      inlineLabel(node.attrs.kind as RawInlineKind, node.attrs.text as string),
    ];
  },
  renderText({ node }) {
    return node.attrs.text as string;
  },
});

/** O que a etiqueta do trecho cru mostra: o nome do link, a fórmula sem os $, a etiqueta */
export function inlineLabel(kind: RawInlineKind, text: string): string {
  switch (kind) {
    case 'link': {
      const inner = text.replace(/^!?\[\[|\]\]$/g, '');
      const shown = inner.includes('|') && /\|[ntpf]:/.test(inner) ? inner.split('|')[0] : inner.split('|').pop();
      return (text.startsWith('!') ? '↳ ' : '') + (shown ?? inner);
    }
    case 'formula':
      return text.replace(/^\$|\$$/g, '');
    case 'imagem':
      return `🖼 ${/^!\[([^\]]*)\]/.exec(text)?.[1] || 'imagem'}`;
    default:
      return text;
  }
}

/** As extensões do editor (o esquema). `view` acrescenta o que só faz sentido na tela. */
export function editorExtensions(view: AnyExtension[] = []): AnyExtension[] {
  return [
    StarterKit.configure({
      // Sublinhado não existe no Markdown; o link vem com o resto
      underline: false,
      link: { openOnClick: false, autolink: true },
      codeBlock: { HTMLAttributes: { spellcheck: 'false' } },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    Highlight,
    RawBlock,
    Callout,
    RawInline,
    SourceAttrs,
    ...view,
  ];
}
