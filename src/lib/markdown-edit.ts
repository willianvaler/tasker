// Formatação simples das anotações (D187): o texto fica em Markdown (negrito, itálico, título,
// listas e caixinhas) e a barra do editor só insere a marcação. Funções puras, com testes.

export type Selection = { start: number; end: number };
export type Format = 'bold' | 'italic' | 'heading' | 'list' | 'numbered' | 'task';
export type Edit = { text: string; selection: Selection };

const WRAP: Partial<Record<Format, string>> = { bold: '**', italic: '_' };
const PREFIX: Partial<Record<Format, (i: number) => string>> = {
  heading: () => '## ',
  list: () => '- ',
  numbered: (i) => `${i + 1}. `,
  task: () => '- [ ] ',
};
// Marcas de começo de linha que um formato de linha substitui (trocar lista por caixinha etc.)
const LINE_MARK = /^(#{1,6} |- \[[ xX]\] |[-*+] |\d+\. )/;

/** Aplica o formato na seleção: envolve (negrito, itálico) ou marca as linhas (título, listas). */
export function applyFormat(text: string, sel: Selection, format: Format): Edit {
  const start = Math.min(sel.start, sel.end);
  const end = Math.max(sel.start, sel.end);
  const wrap = WRAP[format];
  if (wrap) {
    const inner = text.slice(start, end);
    // Já envolvido: tira a marca
    if (
      text.slice(start - wrap.length, start) === wrap &&
      text.slice(end, end + wrap.length) === wrap
    )
      return {
        text: text.slice(0, start - wrap.length) + inner + text.slice(end + wrap.length),
        selection: { start: start - wrap.length, end: end - wrap.length },
      };
    return {
      text: text.slice(0, start) + wrap + inner + wrap + text.slice(end),
      selection: { start: start + wrap.length, end: end + wrap.length },
    };
  }

  const prefix = PREFIX[format];
  if (!prefix) return { text, selection: sel };
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = text.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  const lines = text.slice(lineStart, lineEnd).split('\n');
  // Todas já com este formato: tira (liga e desliga no mesmo botão)
  const has = (line: string, i: number) =>
    format === 'numbered' ? /^\d+\. /.test(line) : line.startsWith(prefix(i));
  const remove = lines.every(has);
  const next = lines.map((line, i) =>
    remove ? line.replace(LINE_MARK, '') : prefix(i) + line.replace(LINE_MARK, ''),
  );
  const block = next.join('\n');
  // Cursor parado: anda o que a marca da linha mudou. Trecho: seleciona as linhas inteiras
  const caret = Math.max(lineStart, start + next[0].length - lines[0].length);
  return {
    text: text.slice(0, lineStart) + block + text.slice(lineEnd),
    selection:
      start === end
        ? { start: caret, end: caret }
        : { start: lineStart, end: lineStart + block.length },
  };
}

/** Caixinhas viram ☐/☑ para a visualização (o leitor de Markdown não desenha caixinha). */
export function withTaskBoxes(text: string): string {
  return text.replace(
    /^(\s*[-*+] )\[([ xX])\] /gm,
    (_, lead: string, mark: string) => `${lead}${mark === ' ' ? '☐' : '☑'} `,
  );
}

/** Texto sem marcação, para títulos e prévias das listas. */
export function plainText(text: string): string {
  return text
    .replace(/^\s*[-*+] \[[ xX]\] /gm, '')
    .replace(/^(#{1,6} |\s*[-*+] |\s*\d+\. |> )/gm, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}
