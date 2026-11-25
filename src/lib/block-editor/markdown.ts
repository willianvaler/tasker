import { getSchema } from '@tiptap/core';
import MarkdownIt, { Token, type StateInline } from 'markdown-it';
import type { Node as PMNode, Schema } from '@tiptap/pm/model';
import {
  MarkdownParser,
  MarkdownSerializer,
  defaultMarkdownSerializer,
} from 'prosemirror-markdown';

import { blocos, type Bloco } from '../note-format';
import { editorExtensions, type RawInlineKind, type RawKind } from './schema';

// Ida e volta do editor de blocos (R1, D370). O Markdown da anotação (ED1) é lido bloco a bloco
// pelo `note-format`, que reparte o texto por posição: cada bloco vira um nó do editor guardando o
// texto original. Ao salvar, o bloco que não mudou devolve esse texto byte a byte; só o editado é
// escrito de novo. O que o editor não sabe mostrar vira bloco cru (texto como está).

export type EditorJSON = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: EditorJSON[];
  text?: string;
};
export type Loaded = { doc: EditorJSON; tail: string };

let cachedSchema: Schema | null = null;
export function editorSchema(): Schema {
  cachedSchema ??= getSchema(editorExtensions());
  return cachedSchema;
}

// ---------------------------------------------------------------------------------------------
// markdown-it com as construções do Questlist na linha
// ---------------------------------------------------------------------------------------------

const RAW_INLINE: { kind: RawInlineKind; re: RegExp; before?: RegExp; end?: boolean }[] = [
  { kind: 'link', re: /^!?\[\[[^\]\n]+\]\]/ },
  { kind: 'imagem', re: /^!\[[^\]\n]*\]\(qlimg:[^)\s]+\)/ },
  { kind: 'rodape', re: /^\[\^[^\]\s]+\]/ },
  // Fórmula na linha como o leitor (D323): `R$ 10` continua dinheiro
  { kind: 'formula', re: /^\$(?=\S)[^$\n]*?\S\$(?!\d)/, before: /[^\p{L}\p{N}$\\]$|^$/u },
  { kind: 'etiqueta', re: /^#[\p{L}\p{N}_/-]+/u, before: /(^|\s)$/ },
  { kind: 'id', re: /^\^[A-Za-z0-9-]{1,32}[ \t]*$/, before: /\s$/, end: true },
];

function rawInlineRule(state: StateInline, silent: boolean): boolean {
  const rest = state.src.slice(state.pos);
  const prev = state.src.slice(Math.max(0, state.pos - 1), state.pos);
  for (const r of RAW_INLINE) {
    if (r.before && !r.before.test(prev)) continue;
    const m = r.re.exec(rest);
    if (!m) continue;
    if (!silent) {
      const token = state.push('ql_raw', '', 0);
      token.meta = { kind: r.kind, text: m[0].trimEnd() };
    }
    state.pos += r.end ? m[0].trimEnd().length : m[0].length;
    return true;
  }
  return false;
}

/** `==destaque==`, com o que estiver dentro lido como linha (negrito dentro do destaque vale) */
function highlightRule(state: StateInline, silent: boolean): boolean {
  if (!state.src.startsWith('==', state.pos)) return false;
  const close = state.src.indexOf('==', state.pos + 2);
  if (close < 0 || close === state.pos + 2) return false;
  const inner = state.src.slice(state.pos + 2, close);
  if (inner.includes('\n') || /^\s|\s$/.test(inner)) return false;
  if (!silent) {
    state.push('mark_open', 'mark', 1);
    state.md.inline.parse(inner, state.md, state.env, state.tokens);
    state.push('mark_close', 'mark', -1);
  }
  state.pos = close + 2;
  return true;
}

const createMd = () =>
  new MarkdownIt('commonmark', { html: false }).enable(['table', 'strikethrough']);
let cachedMd: ReturnType<typeof createMd> | null = null;
function md(): ReturnType<typeof createMd> {
  if (cachedMd) return cachedMd;
  const it = createMd();
  it.inline.ruler.before('link', 'ql_raw', rawInlineRule);
  it.inline.ruler.before('emphasis', 'ql_mark', highlightRule);
  cachedMd = it;
  return it;
}

const TASK = /^\[([ xX])\]\s/;

/** Ajustes nos tokens: célula de tabela com parágrafo dentro, lista de tarefas */
function fixTokens(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (const tok of tokens) {
    if (tok.type === 'th_close' || tok.type === 'td_close') {
      out.push(new (tok.constructor as typeof Token)('paragraph_close', 'p', -1));
    }
    out.push(tok);
    if (tok.type === 'th_open' || tok.type === 'td_open') {
      out.push(new (tok.constructor as typeof Token)('paragraph_open', 'p', 1));
    }
  }
  // Lista de tarefas: todos os itens da lista começam com [ ] ou [x]
  for (let i = 0; i < out.length; i++) {
    if (out[i].type !== 'bullet_list_open') continue;
    let depth = 0;
    const items: number[] = [];
    let j = i;
    for (; j < out.length; j++) {
      if (out[j].type === 'bullet_list_open' || out[j].type === 'ordered_list_open') depth++;
      if (out[j].type === 'bullet_list_close' || out[j].type === 'ordered_list_close') depth--;
      if (depth === 1 && out[j].type === 'list_item_open') items.push(j);
      if (depth === 0) break;
    }
    const firstInline = (k: number) => {
      const p = out[k + 1];
      const inline = out[k + 2];
      return p?.type === 'paragraph_open' && inline?.type === 'inline' ? inline : null;
    };
    const isTask = items.length > 0 && items.every((k) => TASK.test(firstInline(k)?.content ?? ''));
    if (!isTask) continue;
    out[i].type = 'task_list_open';
    out[j].type = 'task_list_close';
    for (const k of items) {
      const inline = firstInline(k);
      if (!inline) continue;
      const checked = /^\[[xX]\]/.test(inline.content);
      out[k].type = 'task_item_open';
      out[k].meta = { checked };
      inline.content = inline.content.replace(TASK, '');
      const first = inline.children?.[0];
      if (first?.type === 'text') first.content = first.content.replace(TASK, '');
    }
    // O fechamento de cada item: o list_item_close do mesmo nível
    depth = 0;
    for (let k = i; k <= j; k++) {
      if (out[k].type.endsWith('_list_open')) depth++;
      if (out[k].type.endsWith('_list_close')) depth--;
      if (depth === 1 && out[k].type === 'list_item_close') out[k].type = 'task_item_close';
    }
  }
  return out;
}

let cachedParser: MarkdownParser | null = null;
function parser(): MarkdownParser {
  if (cachedParser) return cachedParser;
  const it = md();
  const tokenizer = {
    parse: (src: string, env: Record<string, unknown>) => fixTokens(it.parse(src, env)),
  };
  cachedParser = new MarkdownParser(editorSchema(), tokenizer as unknown as ConstructorParameters<typeof MarkdownParser>[1], {
    paragraph: { block: 'paragraph' },
    blockquote: { block: 'blockquote' },
    list_item: { block: 'listItem' },
    bullet_list: { block: 'bulletList' },
    ordered_list: {
      block: 'orderedList',
      getAttrs: (tok) => ({ start: Number(tok.attrGet('start')) || 1 }),
    },
    task_list: { block: 'taskList' },
    task_item: { block: 'taskItem', getAttrs: (tok) => ({ checked: !!tok.meta?.checked }) },
    heading: { block: 'heading', getAttrs: (tok) => ({ level: Number(tok.tag.slice(1)) }) },
    code_block: { block: 'codeBlock', noCloseToken: true },
    fence: {
      block: 'codeBlock',
      getAttrs: (tok) => ({ language: tok.info.trim() || null }),
      noCloseToken: true,
    },
    hr: { node: 'horizontalRule' },
    hardbreak: { node: 'hardBreak' },
    image: {
      node: 'rawInline',
      getAttrs: (tok) => ({
        kind: 'imagem',
        text: `![${tok.content}](${tok.attrGet('src') ?? ''})`,
      }),
    },
    ql_raw: { node: 'rawInline', getAttrs: (tok) => tok.meta, noCloseToken: true },
    table: { block: 'table' },
    thead: { ignore: true },
    tbody: { ignore: true },
    tr: { block: 'tableRow' },
    th: { block: 'tableHeader' },
    td: { block: 'tableCell' },
    em: { mark: 'italic' },
    strong: { mark: 'bold' },
    s: { mark: 'strike' },
    mark: { mark: 'highlight' },
    link: {
      mark: 'link',
      getAttrs: (tok) => ({ href: tok.attrGet('href'), title: tok.attrGet('title') || null }),
    },
    code_inline: { mark: 'code', noCloseToken: true },
  });
  return cachedParser;
}

// ---------------------------------------------------------------------------------------------
// Markdown → documento
// ---------------------------------------------------------------------------------------------

const ID_LINE = /\n\^[A-Za-z0-9-]{1,32}[ \t]*$/;
const CALLOUT = /^ {0,3}>\s?\[!([\w-]+)\]([+-]?)[ \t]*(.*)$/;

/** O conteúdo do nó para comparar (sem os atributos de origem) */
export function fingerprint(node: EditorJSON): string {
  const { attrs, ...rest } = node;
  const own = attrs ? { ...attrs } : undefined;
  if (own) for (const k of ['src', 'orig', 'gap', 'tail']) delete own[k];
  return JSON.stringify({ ...rest, attrs: own });
}

function raw(text: string, kind: RawKind): EditorJSON {
  // O nó de texto do esquema (`text`) não cabe no tipo genérico: o JSON é o do ProseMirror
  const content = text ? [{ type: 'text', text } as EditorJSON] : [];
  return { type: 'rawBlock', attrs: { kind }, content };
}

/** Um bloco do `note-format` vira um nó (ou o bloco cru, se o editor não o reconhecer inteiro) */
function blockNode(src: string, b: Bloco): EditorJSON {
  if (b.tipo === 'formula') return raw(src, 'formula');
  if (b.tipo === 'consulta') return raw(src, 'consulta');
  if (b.tipo === 'botao') return raw(src, 'botao');
  if (b.tipo === 'propriedades') return raw(src, 'propriedades');
  if (b.aberto) return raw(src, 'outro');
  if (b.tipo === 'codigo' && /^questlist/.test(b.linguagem ?? ''))
    return raw(src, b.linguagem === 'questlist-button' ? 'botao' : 'consulta');
  if (/^\s*!\[\[[^\]\n]+\]\]\s*$/.test(src)) return raw(src, 'incorporar');
  // HTML cru fica como está
  if (/^\s*<[a-zA-Z!/]/.test(src)) return raw(src, 'outro');
  if (b.tipo === 'citacao') {
    const first = src.split('\n')[0];
    const c = CALLOUT.exec(first);
    if (c) {
      const inner = src
        .split('\n')
        .slice(1)
        .map((l) => l.replace(/^ {0,3}> ?/, ''))
        .join('\n');
      const content = inner.trim() ? parseMany(inner) : [{ type: 'paragraph' }];
      if (content) {
        return {
          type: 'callout',
          attrs: { kind: c[1].toLowerCase(), fold: c[2], title: c[3] },
          content,
        };
      }
      return raw(src, 'outro');
    }
  }
  const expected: Record<string, string[]> = {
    titulo: ['heading'],
    paragrafo: ['paragraph'],
    lista: ['bulletList', 'orderedList', 'taskList'],
    citacao: ['blockquote'],
    codigo: ['codeBlock'],
    tabela: ['table'],
    regua: ['horizontalRule'],
  };
  const nodes = parseMany(src);
  if (nodes && nodes.length === 1 && expected[b.tipo]?.includes(nodes[0].type)) return nodes[0];
  return raw(src, 'outro');
}

/** Markdown de vários blocos → nós (para o que fica dentro do callout); null se não der */
function parseMany(text: string): EditorJSON[] | null {
  try {
    const doc = parser().parse(text) as PMNode;
    return (doc.toJSON().content ?? []) as EditorJSON[];
  } catch {
    return null;
  }
}

function normalize(node: EditorJSON, src: string): EditorJSON {
  try {
    return editorSchema().nodeFromJSON(node).toJSON() as EditorJSON;
  } catch {
    return raw(src, 'outro');
  }
}

/** O Markdown da anotação → o documento do editor (e o que sobra depois do último bloco). */
export function markdownToDoc(text: string): Loaded {
  const bs = blocos(text);
  const content: EditorJSON[] = [];
  let pos = 0;
  for (const b of bs) {
    const gap = text.slice(pos, b.inicio);
    let src = text.slice(b.inicio, b.fim);
    // `^id` sozinho na linha de baixo (código, tabela, citação): fica de fora da leitura
    let tail = '';
    const idLine = ID_LINE.exec(src);
    if (idLine && b.tipo !== 'paragrafo' && b.tipo !== 'titulo' && b.tipo !== 'lista') {
      tail = idLine[0];
      src = src.slice(0, idLine.index);
    }
    // Pelo esquema: a impressão tem de ser a mesma que o editor vai produzir (ordem dos atributos)
    const node = normalize(blockNode(src, b), src);
    const orig = fingerprint(node);
    content.push({
      ...node,
      attrs: { ...node.attrs, src: src + tail, orig, gap, tail: tail || null },
    });
    pos = b.fim;
  }
  if (content.length === 0) content.push({ type: 'paragraph' });
  return { doc: { type: 'doc', content }, tail: text.slice(pos) };
}

// ---------------------------------------------------------------------------------------------
// Documento → Markdown
// ---------------------------------------------------------------------------------------------

/** Escapa só o que viraria outra coisa: ênfase e código, e o começo de linha que vira bloco */
function escapeText(text: string, lineStart: boolean): string {
  let out = text.replace(/\\/g, '\\\\').replace(/([*_`])/g, '\\$1').replace(/~~/g, '\\~\\~');
  if (lineStart)
    out = out
      .replace(/^(#{1,6})(\s)/, '\\$1$2')
      .replace(/^([>+-])(\s)/, '\\$1$2')
      .replace(/^(\d+)([.)])(\s)/, '$1\\$2$3');
  return out;
}

function cellText(cell: PMNode): string {
  const inner = serializer().serialize(cell, { tightLists: true });
  return inner.replace(/\n+/g, ' ').replace(/\|/g, '\\|').trim();
}

let cachedSerializer: MarkdownSerializer | null = null;
function serializer(): MarkdownSerializer {
  if (cachedSerializer) return cachedSerializer;
  const d = defaultMarkdownSerializer;
  cachedSerializer = new MarkdownSerializer(
    {
      doc: (state, node) => state.renderContent(node),
      paragraph: (state, node) => {
        state.renderInline(node);
        state.closeBlock(node);
      },
      heading: (state, node) => {
        state.write(`${'#'.repeat(node.attrs.level as number)} `);
        state.renderInline(node, false);
        state.closeBlock(node);
      },
      blockquote: (state, node) => state.wrapBlock('> ', null, node, () => state.renderContent(node)),
      callout: (state, node) =>
        state.wrapBlock('> ', null, node, () => {
          const { kind, fold, title } = node.attrs as { kind: string; fold: string; title: string };
          state.write(`[!${kind}]${fold}${title ? ` ${title}` : ''}`);
          state.ensureNewLine();
          state.renderContent(node);
        }),
      codeBlock: (state, node) => {
        const fence = node.textContent.includes('```') ? '~~~' : '```';
        state.write(`${fence}${(node.attrs.language as string | null) ?? ''}\n`);
        state.text(node.textContent, false);
        state.ensureNewLine();
        state.write(fence);
        state.closeBlock(node);
      },
      horizontalRule: (state, node) => {
        state.write('---');
        state.closeBlock(node);
      },
      bulletList: (state, node) => state.renderList(node, '  ', () => '- '),
      orderedList: (state, node) => {
        const start = (node.attrs.start as number) || 1;
        state.renderList(node, '   ', (i) => `${start + i}. `);
      },
      listItem: (state, node) => state.renderContent(node),
      taskList: (state, node) => state.renderList(node, '  ', () => '- '),
      taskItem: (state, node) => {
        state.write(node.attrs.checked ? '[x] ' : '[ ] ');
        state.renderContent(node);
      },
      hardBreak: (state, node, parent, index) => {
        for (let i = index + 1; i < parent.childCount; i++)
          if (parent.child(i).type !== node.type) {
            state.write('\\\n');
            return;
          }
      },
      text: (state, node) => {
        const s = state as unknown as { atBlank(): boolean; closed: unknown };
        state.text(escapeText(node.text ?? '', s.atBlank() || !!s.closed), false);
      },
      rawBlock: (state, node) => {
        state.text(node.textContent, false);
        state.closeBlock(node);
      },
      rawInline: (state, node) => state.write(node.attrs.text as string),
      table: (state, node) => {
        node.forEach((row, _o, i) => {
          const cells: string[] = [];
          row.forEach((cell) => cells.push(cellText(cell)));
          state.write(`| ${cells.join(' | ')} |`);
          state.ensureNewLine();
          if (i === 0) {
            state.write(`| ${cells.map(() => '---').join(' | ')} |`);
            state.ensureNewLine();
          }
        });
        state.closeBlock(node);
      },
      tableRow: () => undefined,
      tableHeader: (state, node) => state.renderContent(node),
      tableCell: (state, node) => state.renderContent(node),
    },
    {
      italic: { open: '_', close: '_', mixable: true, expelEnclosingWhitespace: true },
      bold: { open: '**', close: '**', mixable: true, expelEnclosingWhitespace: true },
      strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
      highlight: { open: '==', close: '==', mixable: true, expelEnclosingWhitespace: true },
      code: d.marks.code,
      link: d.marks.link,
    },
  );
  return cachedSerializer;
}

/** Um nó (sem os atributos de origem) → Markdown */
export function nodeToMarkdown(node: PMNode): string {
  const schema = editorSchema();
  const doc = schema.topNodeType.create(null, [node]);
  return serializer().serialize(doc, { tightLists: true }).replace(/\n+$/, '');
}

/** O documento do editor → o Markdown da anotação. O que não mudou volta igual. */
export function docToMarkdown(doc: PMNode | EditorJSON, tail: string): string {
  const schema = editorSchema();
  const node = 'toJSON' in doc ? (doc as PMNode) : schema.nodeFromJSON(doc);
  let out = '';
  node.forEach((child, _offset, i) => {
    const json = child.toJSON() as EditorJSON;
    const attrs = (child.attrs ?? {}) as Record<string, unknown>;
    const src = attrs.src as string | null;
    const gap = (attrs.gap as string | null) ?? (i === 0 ? '' : '\n\n');
    const same = src !== null && src !== undefined && fingerprint(json) === attrs.orig;
    if (same) {
      out += gap + src;
      return;
    }
    const isEmpty = child.type.name === 'paragraph' && child.childCount === 0;
    // Parágrafo vazio novo: o Markdown não guarda parágrafo vazio
    if (isEmpty && src == null) return;
    out += gap + nodeToMarkdown(child) + ((attrs.tail as string | null) ?? '');
  });
  return out + tail;
}
