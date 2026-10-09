import { parseQuickInput, type ParsedTask, type QuickParseOptions } from './quick';

// Criação em lote (ESCOPO 4.1 e 8): texto colado vira várias tarefas.
//   - Separadores: quebra de linha e ";" (um ";" dentro de aspas não separa)
//   - Marcadores no início saem: "-", "*", "•", "1.", "1)", "[ ]", "[x]" ("*" nunca é recorrência)
//   - "[x]" cria a tarefa já concluída
//   - Linha com recuo (tab ou 2+ espaços) vira subtarefa do item anterior sem recuo
//   - Cada item aceita a sintaxe rápida (parseQuickInput)

export type BatchChild = ParsedTask & { raw: string; done: boolean };
export type BatchItem = BatchChild & { children: BatchChild[] };

const MARKER_RE = /^(?:[-*–]\s+|•\s*|\d{1,3}[.)]\s+)/;
const CHECKBOX_RE = /^\[( |x|X)\]\s*/;
const INDENT_RE = /^(?:\t|\s{2,})/;

/** Divide pelo ";" fora de aspas (retas ou curvas). */
function splitOutsideQuotes(line: string): string[] {
  const pieces: string[] = [];
  let current = '';
  let quote: string | null = null;
  for (const ch of line) {
    if (quote) {
      if (ch === quote || (quote === '“' && ch === '”')) quote = null;
      current += ch;
    } else if (ch === '"' || ch === '“') {
      quote = ch;
      current += ch;
    } else if (ch === ';') {
      pieces.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  pieces.push(current);
  return pieces;
}

/** Remove marcadores de lista e checkbox; diz se estava marcado como feito. */
function stripMarkers(piece: string): { text: string; done: boolean } {
  let text = piece.trim();
  let done = false;
  // Repete para casos como "- [x] tarefa" ou "1. [ ] tarefa"
  for (let guard = 0; guard < 3; guard++) {
    const marker = MARKER_RE.exec(text);
    if (marker) {
      text = text.slice(marker[0].length);
      continue;
    }
    const checkbox = CHECKBOX_RE.exec(text);
    if (checkbox) {
      done = done || checkbox[1].toLowerCase() === 'x';
      text = text.slice(checkbox[0].length);
      continue;
    }
    break;
  }
  text = text.trim();
  // Item inteiro entre aspas: as aspas só serviam para proteger o ";"
  const quoted = /^["“](.*)["”]$/.exec(text);
  if (quoted) text = quoted[1].trim();
  return { text, done };
}

export function parseBatchInput(text: string, options: QuickParseOptions): BatchItem[] {
  const items: BatchItem[] = [];

  for (const line of text.split(/\r?\n/)) {
    const indented = INDENT_RE.test(line);
    const parent = indented ? items[items.length - 1] : undefined;

    for (const piece of splitOutsideQuotes(line)) {
      const { text: raw, done } = stripMarkers(piece);
      if (!raw) continue;
      const parsed = { ...parseQuickInput(raw, options), raw, done };
      if (parent) parent.children.push(parsed);
      else items.push({ ...parsed, children: [] });
    }
  }
  return items;
}

/** Total de tarefas que o lote vai criar (itens + subtarefas). */
export function countBatch(items: BatchItem[]): number {
  return items.reduce((n, item) => n + 1 + item.children.length, 0);
}

/** Texto com mais de um item? (para oferecer a pré-visualização ao colar) */
export function looksLikeBatch(text: string): boolean {
  return /\r?\n/.test(text.trim()) || splitOutsideQuotes(text).filter((p) => p.trim()).length > 1;
}
