// Gerador determinístico de anotações para o ED0/ED5 (ESCOPO_V16): cobre as construções que o app
// conhece (D286 a D298, D323, D324) e algumas que ele não conhece, com semente fixa.

/** Gerador pseudoaleatório com semente (mulberry32): o mesmo número dá as mesmas anotações. */
export function semente(n: number) {
  let a = n >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALAVRAS =
  'casa projeto reunião tarefa café estudo leitura mercado treino ação ideia revisão prazo conta viagem música código teste pão'.split(
    ' ',
  );

export type NotaGerada = { id: string; title: string; body: string; props: Record<string, unknown> };

/** Construções, cada uma uma função do gerador e dos ids já criados (para os links). */
const BLOCOS: ((r: () => number, ids: string[], frase: () => string) => string)[] = [
  (_r, _i, f) => `# ${f()}`,
  (_r, _i, f) => `## ${f()}`,
  (_r, _i, f) => f(),
  (_r, _i, f) => `- ${f()}\n- ${f()}\n  - ${f()}`,
  (_r, _i, f) => `1. ${f()}\n2. ${f()}`,
  (_r, _i, f) => `- [ ] ${f()}\n- [x] ${f()}`,
  (_r, _i, f) => `> [!tip] ${f()}\n> ${f()}`,
  (_r, _i, f) => `Texto com ==destaque== e **negrito**, _itálico_ e \`código\`: ${f()}`,
  (_r, _i, f) => `Nota de rodapé[^1] ${f()}\n\n[^1]: ${f()}`,
  (_r, _i, f) => `| a | b |\n| --- | --- |\n| ${f()} | 1 |`,
  (_r, _i, f) => '```ts\nconst x = 1; // ' + f() + '\n```',
  (_r, _i, f) => `$$\n\\int_0^1 x^2\\,dx = \\frac{1}{3}\n$$\n${f()}`,
  (r, ids, f) => (ids.length ? `Ver [[Nota ${Math.floor(r() * ids.length)}|n:${ids[Math.floor(r() * ids.length)]}]] ${f()}` : f()),
  (r, ids) => (ids.length ? `![[Nota|n:${ids[Math.floor(r() * ids.length)]}]]` : 'sem incorporar'),
  (_r, _i, f) => `[[Título que não existe]] e #etiqueta ${f()}`,
  () => '```questlist\nnotas com tag:casa\n```',
  (_r, _i, f) => `<details><summary>${f()}</summary>html cru</details>`,
  (_r, _i, f) => `Linha com espaço no fim   \n${f()}`,
  (_r, _i, f) => `${f()} ^bloco1`,
];

export function gerarNotas(n: number, seed = 42): NotaGerada[] {
  const r = semente(seed);
  const frase = () =>
    Array.from({ length: 3 + Math.floor(r() * 8) }, () => PALAVRAS[Math.floor(r() * PALAVRAS.length)]).join(' ');
  const ids: string[] = [];
  const out: NotaGerada[] = [];
  for (let i = 0; i < n; i++) {
    const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    const blocos = Array.from({ length: 3 + Math.floor(r() * 12) }, () => BLOCOS[Math.floor(r() * BLOCOS.length)](r, ids, frase));
    const props: Record<string, unknown> = {};
    if (r() < 0.5) props.tags = ['casa', 'estudo'].slice(0, 1 + Math.floor(r() * 2));
    if (r() < 0.3) props.prazo = '2026-12-01';
    if (r() < 0.2) props.feito = r() < 0.5;
    if (r() < 0.2) props.nota = Math.floor(r() * 10);
    out.push({ id, title: `Nota ${i}`, body: blocos.join('\n\n'), props });
    ids.push(id);
  }
  return out;
}

/** Uma anotação grande: `blocos` parágrafos e itens, para os orçamentos de abrir e digitar. */
export function notaGrande(blocos: number, seed = 7): string {
  const r = semente(seed);
  const linhas: string[] = [];
  for (let i = 0; i < blocos; i++) {
    const p = Array.from({ length: 4 + Math.floor(r() * 6) }, () => PALAVRAS[Math.floor(r() * PALAVRAS.length)]).join(' ');
    linhas.push(i % 10 === 0 ? `## Seção ${i / 10}` : i % 3 === 0 ? `- ${p}` : p);
  }
  return linhas.join('\n\n');
}
