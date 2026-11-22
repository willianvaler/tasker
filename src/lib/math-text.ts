// Fórmulas LaTeX no Markdown (ES2, ESCOPO_V13 §2, D323), com as regras do Obsidian: `$$...$$` em
// bloco (numa linha só ou em várias) e `$...$` na linha. Puro, com teste: acha as fórmulas antes de
// o Markdown mexer no texto (destaque, etiqueta e rodapé estragariam o LaTeX) e troca cada uma por
// uma marca que o NoteMarkdown desenha. Fora das cercas de código e dos trechos `código`.

/** Esquema da fórmula na linha (o leitor de Markdown só aceita esquema só com letras) */
export const MATH_SCHEME = 'questlistmath:';
/** Marca de bloco: uma linha só com ela, trocada pela fórmula ao separar os trechos */
const BLOCK_MARK = (n: number) => `⁣QLMATH${n}⁣`;
const BLOCK_LINE = /^⁣QLMATH(\d+)⁣$/;

/** O LaTeX dentro do destino do link: os parênteses também, para o link não quebrar */
export const encodeTex = (tex: string) =>
  encodeURIComponent(tex).replace(/\(/g, '%28').replace(/\)/g, '%29');
export const decodeTex = (href: string) => {
  try {
    return decodeURIComponent(href.slice(MATH_SCHEME.length));
  } catch {
    return href.slice(MATH_SCHEME.length);
  }
};

/**
 * `$...$` na linha vira `[ƒ](questlistmath:<tex>)`. Abre num `$` que não é `$$`, não vem depois de
 * `\` e tem algo que não é espaço em seguida; fecha no próximo `$` que vem depois de algo que não é
 * espaço e não é seguido de dígito. Assim "R$ 10" e "R$10 e R$20" não viram fórmula.
 */
export function inlineMath(line: string): string {
  return line.replace(
    /(^|[^\\$])\$(?!\$)(?=\S)((?:\\\$|[^$\n])*?\S)\$(?![\d$])/g,
    (_, lead: string, tex: string) => `${lead}[ƒ](${MATH_SCHEME}${encodeTex(tex)})`,
  );
}

/** Aplica `fn` no texto da linha fora dos trechos `código` */
const outsideInlineCode = (line: string, fn: (part: string) => string) =>
  line
    .split(/(`+[^`]*`+)/g)
    .map((part, i) => (i % 2 ? part : fn(part)))
    .join('');

export type MathPrepared = { text: string; blocks: string[] };

/**
 * Tira as fórmulas do texto: cada bloco `$$...$$` vira uma linha de marca (e o LaTeX vai para
 * `blocks`), e cada `$...$` vira o link da fórmula na linha. Bloco sem fechamento fica como texto.
 */
export function extractMath(text: string): MathPrepared {
  const lines = text.split('\n');
  const out: string[] = [];
  const blocks: string[] = [];
  let fence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      fence = !fence;
      out.push(line);
      continue;
    }
    if (fence || /^( {4}|\t)/.test(line)) {
      out.push(line);
      continue;
    }
    const open = /^\s*\$\$(.*)$/.exec(line);
    if (open) {
      // Numa linha só: $$ x $$
      const same = /^(.*?)\$\$\s*$/.exec(open[1]);
      if (same && same[1].trim()) {
        blocks.push(same[1].trim());
        out.push(BLOCK_MARK(blocks.length - 1));
        continue;
      }
      // Em várias linhas: até a linha que termina em $$
      const body: string[] = open[1].trim() ? [open[1]] : [];
      let j = i + 1;
      let closed = false;
      for (; j < lines.length; j++) {
        const end = /^(.*?)\$\$\s*$/.exec(lines[j]);
        if (end) {
          if (end[1].trim()) body.push(end[1]);
          closed = true;
          break;
        }
        body.push(lines[j]);
      }
      if (closed && body.join('').trim()) {
        blocks.push(body.join('\n').trim());
        out.push(BLOCK_MARK(blocks.length - 1));
        i = j;
        continue;
      }
    }
    out.push(outsideInlineCode(line, inlineMath));
  }
  return { text: out.join('\n'), blocks };
}

export type MathSegment = { kind: 'markdown'; text: string } | { kind: 'math'; tex: string };

/** Separa um trecho em Markdown e blocos de fórmula, nas linhas de marca. */
export function splitMathBlocks(text: string, blocks: readonly string[]): MathSegment[] {
  const out: MathSegment[] = [];
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.join('').trim()) out.push({ kind: 'markdown', text: buffer.join('\n') });
    buffer = [];
  };
  for (const line of text.split('\n')) {
    const mark = BLOCK_LINE.exec(line.trim());
    const tex = mark ? blocks[Number(mark[1])] : undefined;
    if (tex === undefined) {
      buffer.push(line);
      continue;
    }
    flush();
    out.push({ kind: 'math', tex });
  }
  flush();
  return out;
}

/** Linha de marca de bloco (num callout, onde o bloco não é separado, volta a ser o LaTeX) */
export function restoreBlocks(text: string, blocks: readonly string[]): string {
  return text
    .split('\n')
    .map((line) => {
      const mark = BLOCK_LINE.exec(line.trim());
      const tex = mark ? blocks[Number(mark[1])] : undefined;
      return tex === undefined ? line : `$$${tex}$$`;
    })
    .join('\n');
}
