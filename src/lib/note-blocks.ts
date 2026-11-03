// Edição e leitura das anotações (OB3, ESCOPO_V11 §7): callouts, destaque, notas de rodapé,
// sumário, contagem de palavras e comandos de barra. Funções puras, com testes.

import { plainText } from '@/lib/markdown-edit';
import { cleanTag, TAG_IN_TEXT } from '@/lib/note-props';
import { headingKey } from '@/lib/wikilinks';

// ─── Callouts ──────────────────────────────────────────────────────────────────────────────────

export type CalloutType =
  'note' | 'info' | 'tip' | 'success' | 'question' | 'warning' | 'danger' | 'quote';

/** Os nomes do Obsidian (em inglês, para importar e exportar) e os do app em pt-BR e es */
const CALLOUT_ALIASES: Record<string, CalloutType> = {
  note: 'note',
  nota: 'note',
  abstract: 'info',
  summary: 'info',
  tldr: 'info',
  resumo: 'info',
  resumen: 'info',
  info: 'info',
  todo: 'info',
  tip: 'tip',
  hint: 'tip',
  important: 'tip',
  dica: 'tip',
  importante: 'tip',
  consejo: 'tip',
  success: 'success',
  check: 'success',
  done: 'success',
  sucesso: 'success',
  feito: 'success',
  exito: 'success',
  question: 'question',
  help: 'question',
  faq: 'question',
  pergunta: 'question',
  duvida: 'question',
  pregunta: 'question',
  warning: 'warning',
  caution: 'warning',
  attention: 'warning',
  aviso: 'warning',
  atencao: 'warning',
  cuidado: 'warning',
  advertencia: 'warning',
  danger: 'danger',
  error: 'danger',
  failure: 'danger',
  fail: 'danger',
  missing: 'danger',
  bug: 'danger',
  perigo: 'danger',
  erro: 'danger',
  peligro: 'danger',
  quote: 'quote',
  cite: 'quote',
  example: 'quote',
  citacao: 'quote',
  exemplo: 'quote',
  cita: 'quote',
  ejemplo: 'quote',
};

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function calloutType(name: string): CalloutType {
  return CALLOUT_ALIASES[fold(name.trim())] ?? 'note';
}

export type NoteSegment =
  | { kind: 'markdown'; text: string }
  | {
      kind: 'callout';
      type: CalloutType;
      /** O título escrito depois do [!tipo]; vazio: o nome do tipo */
      title: string;
      /** `+` abre aberto e recolhível, `-` abre fechado; sem nada, não recolhe */
      fold: 'open' | 'closed' | null;
      body: string;
    };

const CALLOUT_HEAD = /^ {0,3}> ?\[!([^\]\s]+)\]([+-])?[ \t]*(.*)$/;
const QUOTE_LINE = /^ {0,3}>/;

/**
 * Separa os callouts (`> [!dica] Título`, as linhas seguintes com `>`) do resto do Markdown, fora
 * das cercas de código. O corpo sai sem o `>` do começo das linhas.
 */
export function splitCallouts(text: string): NoteSegment[] {
  const out: NoteSegment[] = [];
  const lines = text.split('\n');
  let buffer: string[] = [];
  let fence = false;
  const flush = () => {
    if (buffer.length) out.push({ kind: 'markdown', text: buffer.join('\n') });
    buffer = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) fence = !fence;
    const head = fence ? null : CALLOUT_HEAD.exec(line);
    // Dentro de uma citação comum (a linha de cima também é `>`), não é callout
    if (!head || (buffer.length > 0 && QUOTE_LINE.test(buffer[buffer.length - 1]))) {
      buffer.push(line);
      continue;
    }
    const body: string[] = [];
    while (i + 1 < lines.length && QUOTE_LINE.test(lines[i + 1])) {
      i++;
      body.push(lines[i].replace(/^ {0,3}> ?/, ''));
    }
    flush();
    out.push({
      kind: 'callout',
      type: calloutType(head[1]),
      title: head[3].trim(),
      fold: head[2] === '+' ? 'open' : head[2] === '-' ? 'closed' : null,
      body: body.join('\n'),
    });
  }
  flush();
  return out;
}

// ─── Destaque e notas de rodapé ───────────────────────────────────────────────────────────────

// Sem hífen: o leitor de Markdown só aceita esquema só com letras (senão põe a base na frente)
export const MARK_SCHEME = 'questlistmark:';
export const FOOTNOTE_SCHEME = 'questlistfn:';
export const TAG_SCHEME = 'questlisttag:';

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export const superscript = (n: number) =>
  String(n)
    .split('')
    .map((d) => SUPERSCRIPT[Number(d)])
    .join('');

/** Aplica `fn` no texto fora das cercas de código e dos trechos `código` da linha */
function outsideCode(text: string, fn: (part: string) => string): string {
  let fence = false;
  return text
    .split('\n')
    .map((line) => {
      if (/^\s*```/.test(line)) {
        fence = !fence;
        return line;
      }
      if (fence || /^( {4}|\t)/.test(line)) return line;
      return line
        .split(/(`+[^`]*`+)/g)
        .map((part, i) => (i % 2 ? part : fn(part)))
        .join('');
    })
    .join('\n');
}

export type Footnote = { id: string; number: number; text: string };

const FOOTNOTE_DEF = /^\[\^([^\]\s]+)\]:[ \t]*(.*)$/;

/**
 * Prepara o Markdown para o leitor, que não conhece `==destaque==` nem notas de rodapé: o destaque
 * vira um link `questlistmark:` e a chamada `[^1]` um link `questlistfn:` com o número em
 * sobrescrito (o desenho fica no NoteMarkdown); o `#etiqueta` vira um link `questlisttag:`. As definições `[^1]: texto` saem do lugar e voltam
 * na ordem da primeira chamada; definição sem chamada vai para o fim.
 */
export function prepareMarkdown(text: string): { text: string; footnotes: Footnote[] } {
  const defs = new Map<string, string>();
  let fence = false;
  const kept: string[] = [];
  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) fence = !fence;
    const def = fence ? null : FOOTNOTE_DEF.exec(line);
    if (def && !defs.has(def[1])) defs.set(def[1], def[2]);
    else kept.push(line);
  }
  const numbers = new Map<string, number>();
  const body = outsideCode(kept.join('\n'), (part) =>
    part
      .replace(/(^|[^=\\])==(?=\S)([^=[\]\n]*?\S)==(?!=)/g, (_, lead: string, inner: string) => {
        return `${lead}[${inner}](${MARK_SCHEME})`;
      })
      .replace(/\[\^([^\]\s]+)\](?!:)/g, (whole, id: string) => {
        if (!defs.has(id)) return whole;
        if (!numbers.has(id)) numbers.set(id, numbers.size + 1);
        const n = numbers.get(id)!;
        return `[${superscript(n)}](${FOOTNOTE_SCHEME}${n})`;
      })
      // #etiqueta (OB4): tocar abre a tela de etiquetas
      .replace(TAG_IN_TEXT, (whole, lead: string, raw: string) => {
        const tag = cleanTag(raw);
        return tag ? `${lead}[#${raw}](${TAG_SCHEME}${encodeURIComponent(tag)})` : whole;
      }),
  );
  for (const id of defs.keys()) if (!numbers.has(id)) numbers.set(id, numbers.size + 1);
  const footnotes = [...numbers.entries()]
    .map(([id, number]) => ({ id, number, text: defs.get(id) ?? '' }))
    .sort((a, b) => a.number - b.number);
  return { text: body, footnotes };
}

// ─── Sumário e contagem ───────────────────────────────────────────────────────────────────────

export type OutlineItem = { level: number; text: string };

const WIKI = /!?\[\[([^\]|#]*)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;

/**
 * Os títulos da anotação, na ordem em que aparecem formatados (fora das cercas de código e dos
 * callouts, que não entram no sumário nem nas âncoras). O texto sai sem a marcação.
 */
export function noteOutline(text: string): OutlineItem[] {
  const out: OutlineItem[] = [];
  for (const segment of splitCallouts(text)) {
    if (segment.kind !== 'markdown') continue;
    let fence = false;
    for (const line of segment.text.split('\n')) {
      if (/^\s*```/.test(line)) fence = !fence;
      else if (!fence) {
        const m = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
        if (m)
          out.push({
            level: m[1].length,
            text: plainText(m[2].replace(WIKI, '$1')).replace(/==/g, '').trim(),
          });
      }
    }
  }
  return out;
}

/** Posição do título da âncora `[[Anotação#Título]]` no sumário, ou -1 */
export function outlineIndex(text: string, anchor: string): number {
  const key = headingKey(anchor);
  return noteOutline(text).findIndex((h) => headingKey(h.text) === key);
}

/** Palavras do texto, sem a marcação (links contam pelo nome; cercas de código ficam de fora) */
export function wordCount(text: string): number {
  let fence = false;
  const lines = text.split('\n').filter((line) => {
    if (/^\s*```/.test(line)) {
      fence = !fence;
      return false;
    }
    return !fence;
  });
  const clean = plainText(
    lines
      .join('\n')
      .replace(WIKI, '$1')
      .replace(/\[!\w+\][+-]?/g, '')
      .replace(/\[\^[^\]]+\]:?/g, '')
      .replace(/^\s*\|?\s*:?-{3,}.*$/gm, '')
      .replace(/[|=#>]/g, ' '),
  );
  return clean.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

// ─── Comandos de barra ────────────────────────────────────────────────────────────────────────

/** O "/consulta" no começo da linha, até o cursor; null fora dele */
export function slashQuery(text: string, caret: number): { start: number; query: string } | null {
  const lineStart = text.lastIndexOf('\n', caret - 1) + 1;
  const m = /^(\s*)\/([\p{L}\p{N}]{0,20})$/u.exec(text.slice(lineStart, caret));
  if (!m) return null;
  return { start: lineStart + m[1].length, query: m[2] };
}

export type SlashCommand =
  | 'heading'
  | 'subheading'
  | 'list'
  | 'numbered'
  | 'task'
  | 'note'
  | 'tip'
  | 'warning'
  | 'table'
  | 'link'
  | 'highlight'
  | 'footnote'
  | 'code'
  | 'divider';

export const SLASH_COMMANDS: SlashCommand[] = [
  'heading',
  'subheading',
  'list',
  'numbered',
  'task',
  'note',
  'tip',
  'warning',
  'table',
  'link',
  'highlight',
  'footnote',
  'code',
  'divider',
];

/** Filtra pelo nome (e pelos outros nomes) do comando, sem acento; o que começa igual vem antes */
export function filterSlash<T extends { names: string[] }>(items: T[], query: string): T[] {
  const q = fold(query);
  if (!q) return items;
  const score = (item: T) => {
    const names = item.names.map(fold);
    if (names.some((n) => n.startsWith(q))) return 0;
    if (names.some((n) => n.split(/\s+/).some((w) => w.startsWith(q)))) return 1;
    return 2;
  };
  return items
    .map((item, i) => ({ item, i, s: score(item) }))
    .filter((x) => x.s < 2)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.item);
}

/** Próximo número livre de nota de rodapé */
function nextFootnote(text: string): number {
  let max = 0;
  for (const m of text.matchAll(/\[\^(\d+)\]/g)) max = Math.max(max, Number(m[1]));
  return max + 1;
}

/**
 * Troca o "/consulta" (de `start` ao cursor) pelo que o comando insere e diz onde o cursor fica.
 * `words` traz o texto que vai junto, no idioma da pessoa (nomes das colunas da tabela).
 */
export function applySlash(
  text: string,
  start: number,
  caret: number,
  command: SlashCommand,
  words: { column: string } = { column: 'Coluna' },
): { text: string; caret: number } {
  const before = text.slice(0, start);
  const after = text.slice(caret);
  const put = (snippet: string, at: number, tail = after) => ({
    text: before + snippet + tail,
    caret: before.length + at,
  });
  switch (command) {
    case 'heading':
      return put('## ', 3);
    case 'subheading':
      return put('### ', 4);
    case 'list':
      return put('- ', 2);
    case 'numbered':
      return put('1. ', 3);
    case 'task':
      return put('- [ ] ', 6);
    case 'note':
    case 'tip':
    case 'warning': {
      const head = `> [!${command}] `;
      return put(head, head.length);
    }
    case 'table': {
      const c = words.column;
      const snippet = `| ${c} 1 | ${c} 2 |\n| --- | --- |\n|  |  |`;
      return put(snippet, snippet.length - 5);
    }
    case 'link':
      return put('[[', 2);
    case 'highlight':
      return put('====', 2);
    case 'code':
      return put('```\n\n```', 4);
    case 'divider': {
      // A linha "---" logo depois de um texto vira título (setext): precisa da linha vazia
      const lead = before.length && !before.endsWith('\n\n') ? '\n' : '';
      return put(`${lead}---\n`, lead.length + 4);
    }
    case 'footnote': {
      const n = nextFootnote(text);
      const ref = `[^${n}]`;
      const rest = after.replace(/\s+$/, '');
      const def = `\n\n[^${n}]: `;
      return {
        text: before + ref + rest + def,
        caret: (before + ref + rest + def).length,
      };
    }
  }
}
