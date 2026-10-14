import { parseQuickInput, type ParsedTask, type QuickParseOptions } from './quick';

// Criação em lote: texto colado vira várias tarefas.
//   - Separadores: quebra de linha e ";" (um ";" dentro de aspas não separa)
//   - Marcadores no início saem: "-", "*", "•", "1.", "1)", "[ ]", "[x]" ("*" nunca é recorrência)
//   - "[x]" cria a tarefa já concluída
//   - Recuo (cada tab ou par de espaços é um nível) vira subtarefa do item de cima, em quantos
//     níveis houver; recuo que pula níveis desce só um. Passou do limite (`maxDepth`): fica no
//     último nível permitido, marcado como `flattened` (a prévia avisa)
//   - Cada item aceita a sintaxe rápida (parseQuickInput)

export type BatchItem = ParsedTask & {
  raw: string;
  done: boolean;
  children: BatchItem[];
  /** Estava num nível além do limite e subiu para o último permitido */
  flattened?: boolean;
};
/** Mesmo formato: uma subtarefa também pode ter subtarefas. */
export type BatchChild = BatchItem;

const MARKER_RE = /^(?:[-*–]\s+|•\s*|\d{1,3}[.)]\s+)/;
const CHECKBOX_RE = /^\[( |x|X)\]\s*/;
const INDENT_RE = /^[\t ]*/;

/** Nível pelo recuo: cada tab, ou cada 2 espaços, é um nível (0 = sem recuo). */
function indentLevel(line: string) {
  const lead = INDENT_RE.exec(line)?.[0] ?? '';
  let level = 0;
  let spaces = 0;
  for (const ch of lead) {
    if (ch === '\t') {
      level++;
      spaces = 0;
    } else if (++spaces === 2) {
      level++;
      spaces = 0;
    }
  }
  return level;
}

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

export function parseBatchInput(
  text: string,
  options: QuickParseOptions & { maxDepth?: number },
): BatchItem[] {
  const items: BatchItem[] = [];
  // Pilha da linha anterior: stack[n] é o último item do nível n (0 = raiz)
  const stack: BatchItem[] = [];
  const deepest = Math.max(1, options.maxDepth ?? Infinity) - 1;

  for (const line of text.split(/\r?\n/)) {
    // Não desce mais de um nível de cada vez; acima do limite, fica no último nível
    const wanted = Math.min(indentLevel(line), stack.length);
    const level = Math.min(wanted, deepest);
    const parent = level > 0 ? stack[level - 1] : undefined;

    for (const piece of splitOutsideQuotes(line)) {
      const { text: raw, done } = stripMarkers(piece);
      if (!raw) continue;
      const item: BatchItem = {
        ...parseQuickInput(raw, options),
        raw,
        done,
        children: [],
        ...(wanted > level ? { flattened: true } : {}),
      };
      if (parent) parent.children.push(item);
      else items.push(item);
      stack.length = level;
      stack.push(item);
    }
  }
  return items;
}

/** Quantos itens subiram de nível por causa do limite. */
export function countFlattened(items: BatchItem[]): number {
  return items.reduce((n, item) => n + (item.flattened ? 1 : 0) + countFlattened(item.children), 0);
}

/** Total de tarefas que o lote vai criar (itens + subtarefas). */
export function countBatch(items: BatchItem[]): number {
  return items.reduce((n, item) => n + 1 + countBatch(item.children), 0);
}

/** Texto com mais de um item? (para oferecer a pré-visualização ao colar) */
export function looksLikeBatch(text: string): boolean {
  return /\r?\n/.test(text.trim()) || splitOutsideQuotes(text).filter((p) => p.trim()).length > 1;
}
