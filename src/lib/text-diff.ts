// Diferença entre duas versões de um texto, por linha (OB11, D296): o histórico de versões da
// anotação mostra o que entrou e o que saiu. LCS simples; texto grande demais cai numa comparação
// pelo começo e pelo fim (as anotações têm até 20 mil caracteres, então quase nunca). Funções puras.

export type DiffLine = { type: 'same' | 'add' | 'del'; text: string };
/** Trecho igual escondido no meio (só o número de linhas) */
export type DiffChunk = DiffLine | { type: 'skip'; count: number };

/** Acima disso (linhas × linhas), a LCS pesaria no celular */
const MAX_CELLS = 4_000_000;

export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');
  // O começo e o fim iguais saem da conta
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const head: DiffLine[] = a.slice(0, start).map((text) => ({ type: 'same', text }));
  const tail: DiffLine[] = a.slice(endA).map((text) => ({ type: 'same', text }));
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const n = midA.length;
  const m = midB.length;
  let middle: DiffLine[];
  if (n * m > MAX_CELLS) {
    middle = [
      ...midA.map((text): DiffLine => ({ type: 'del', text })),
      ...midB.map((text): DiffLine => ({ type: 'add', text })),
    ];
  } else {
    // lcs[i][j] = maior trecho comum de midA[i..] e midB[j..]
    const width = m + 1;
    const lcs = new Uint32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        lcs[i * width + j] =
          midA[i] === midB[j]
            ? lcs[(i + 1) * width + j + 1] + 1
            : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
    middle = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        middle.push({ type: 'same', text: midA[i] });
        i++;
        j++;
      } else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
        middle.push({ type: 'del', text: midA[i++] });
      } else {
        middle.push({ type: 'add', text: midB[j++] });
      }
    }
    while (i < n) middle.push({ type: 'del', text: midA[i++] });
    while (j < m) middle.push({ type: 'add', text: midB[j++] });
  }
  return [...head, ...middle, ...tail];
}

/** Quantas linhas entraram e saíram */
export function diffStats(lines: readonly DiffLine[]) {
  let added = 0;
  let removed = 0;
  for (const l of lines) {
    if (l.type === 'add') added++;
    else if (l.type === 'del') removed++;
  }
  return { added, removed };
}

/** Só o que mudou, com `context` linhas iguais em volta; o resto vira "… N linhas iguais" */
export function collapseDiff(lines: readonly DiffLine[], context = 2): DiffChunk[] {
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((l, i) => {
    if (l.type === 'same') return;
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++)
      keep[k] = true;
  });
  const out: DiffChunk[] = [];
  let skipped = 0;
  lines.forEach((l, i) => {
    if (keep[i]) {
      if (skipped) out.push({ type: 'skip', count: skipped });
      skipped = 0;
      out.push(l);
    } else skipped++;
  });
  if (skipped) out.push({ type: 'skip', count: skipped });
  return out;
}
