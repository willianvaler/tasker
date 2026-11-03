// Grafo das ligações (OB9, ESCOPO_V11 §6, D294): anotações, tarefas, listas e pastas como pontos e
// os [[links]] da tabela `links` (OB1) como linhas. Monta, filtra, acha os vizinhos (grafo local) e
// dá posição aos pontos com um layout de força simples, determinístico e sem animação.
// Funções puras, com testes.

import { fold } from './query/parse';
import type { LinkKind } from './wikilinks';

export type GraphKind = LinkKind | 'ghost';
export type GraphNode = {
  /** `<kind>:<id>`; o fantasma (link para o que não existe) é `ghost:<título sem acento>` */
  key: string;
  kind: GraphKind;
  /** O id do item (vazio no fantasma) */
  id: string;
  title: string;
  tags: string[];
  /** A pasta do item (a raiz e a subpasta valem no filtro) */
  folderId: string | null;
  /** Quantas linhas tocam o ponto */
  degree: number;
};
export type GraphEdge = { key: string; source: string; target: string };
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };

export type GraphLinkRow = {
  source_kind: 'note' | 'task';
  source_id: string;
  target_kind: LinkKind | null;
  target_id: string | null;
  target_title: string;
};
export type GraphItem = {
  id: string;
  title: string;
  tags?: string[] | null;
  folderId?: string | null;
};

export const nodeKey = (kind: GraphKind, id: string) => `${kind}:${id}`;

/**
 * Monta o grafo. Toda anotação entra (as soltas também, como no Obsidian); tarefas, listas e pastas
 * só quando há link. Link para o que a pessoa não vê fica de fora; o que ainda não existe vira um
 * ponto fantasma pelo título (um só por título).
 */
export function buildGraph(input: {
  links: readonly GraphLinkRow[];
  notes: readonly GraphItem[];
  tasks: ReadonlyMap<string, GraphItem>;
  pages: readonly GraphItem[];
  folders: readonly GraphItem[];
}): Graph {
  const nodes = new Map<string, GraphNode>();
  const add = (kind: GraphKind, item: GraphItem) => {
    const key = nodeKey(kind, item.id);
    if (!nodes.has(key))
      nodes.set(key, {
        key,
        kind,
        id: kind === 'ghost' ? '' : item.id,
        title: item.title,
        tags: [...(item.tags ?? [])],
        folderId: item.folderId ?? null,
        degree: 0,
      });
    return key;
  };
  const notes = new Map(input.notes.map((n) => [n.id, n]));
  const pages = new Map(input.pages.map((p) => [p.id, p]));
  const folders = new Map(input.folders.map((f) => [f.id, f]));
  for (const n of input.notes) add('note', n);
  const find = (kind: LinkKind, id: string): GraphItem | undefined =>
    kind === 'note'
      ? notes.get(id)
      : kind === 'task'
        ? input.tasks.get(id)
        : kind === 'page'
          ? pages.get(id)
          : folders.get(id);

  const edges = new Map<string, GraphEdge>();
  for (const link of input.links) {
    const from = find(link.source_kind, link.source_id);
    if (!from) continue;
    let target: string | null = null;
    if (link.target_kind && link.target_id) {
      const to = find(link.target_kind, link.target_id);
      if (to) target = add(link.target_kind, to);
    } else if (link.target_title.trim()) {
      target = add('ghost', {
        id: fold(link.target_title.trim()),
        title: link.target_title.trim(),
      });
    }
    if (!target) continue;
    const source = add(link.source_kind, from);
    if (source === target) continue;
    // Uma linha por par, nos dois sentidos
    const [a, b] = source < target ? [source, target] : [target, source];
    const key = `${a}|${b}`;
    if (!edges.has(key)) edges.set(key, { key, source, target });
  }
  for (const e of edges.values()) {
    nodes.get(e.source)!.degree++;
    nodes.get(e.target)!.degree++;
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

export type GraphFilter = {
  kinds: readonly GraphKind[];
  /** Só os pontos com esta etiqueta (sem #, aninhada vale: `treino` pega `treino/perna`) */
  tag?: string | null;
  /** Só os da pasta (com as subpastas) */
  folderIds?: readonly string[] | null;
  /** Mostrar as anotações sem nenhuma ligação */
  orphans: boolean;
  /** Só o que está ligado a este ponto, até `depth` passos */
  focus?: string | null;
  depth?: number;
};

/** Os pontos a até `depth` passos de `start` (ele incluído) */
export function neighborhood(graph: Graph, start: string, depth: number): Set<string> {
  const near = new Map<string, string[]>();
  for (const e of graph.edges) {
    (near.get(e.source) ?? near.set(e.source, []).get(e.source)!).push(e.target);
    (near.get(e.target) ?? near.set(e.target, []).get(e.target)!).push(e.source);
  }
  const seen = new Set([start]);
  let frontier = [start];
  for (let step = 0; step < depth && frontier.length; step++) {
    const next: string[] = [];
    for (const key of frontier)
      for (const other of near.get(key) ?? [])
        if (!seen.has(other)) {
          seen.add(other);
          next.push(other);
        }
    frontier = next;
  }
  return seen;
}

const hasTag = (tags: readonly string[], want: string) =>
  tags.some((t) => {
    const tag = fold(t.replace(/^#/, ''));
    return tag === want || tag.startsWith(`${want}/`);
  });

/** Aplica os filtros; as linhas ficam só entre os pontos que sobraram (o grau é recontado) */
export function filterGraph(graph: Graph, filter: GraphFilter): Graph {
  const kinds = new Set(filter.kinds);
  const tag = filter.tag ? fold(filter.tag.trim().replace(/^#/, '')) : '';
  const inFolder = filter.folderIds?.length ? new Set(filter.folderIds) : null;
  const near = filter.focus ? neighborhood(graph, filter.focus, filter.depth ?? 2) : null;
  let keep = graph.nodes.filter(
    (n) =>
      (kinds.has(n.kind) || n.key === filter.focus) &&
      (!tag || hasTag(n.tags, tag)) &&
      (!inFolder || (n.folderId !== null && inFolder.has(n.folderId)) || n.key === filter.focus) &&
      (!near || near.has(n.key)),
  );
  const keys = new Set(keep.map((n) => n.key));
  const edges = graph.edges.filter((e) => keys.has(e.source) && keys.has(e.target));
  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  keep = keep
    .map((n) => ({ ...n, degree: degree.get(n.key) ?? 0 }))
    .filter((n) => filter.orphans || n.degree > 0 || n.key === filter.focus);
  const left = new Set(keep.map((n) => n.key));
  return { nodes: keep, edges: edges.filter((e) => left.has(e.source) && left.has(e.target)) };
}

export type Point = { x: number; y: number };

/**
 * Layout de força (Fruchterman-Reingold): começa numa espiral (sempre o mesmo desenho para o mesmo
 * grafo) e roda um número fixo de passos, menos quando o grafo é grande. Sem aleatório.
 */
export function forceLayout(graph: Graph, opts: { spacing?: number } = {}): Map<string, Point> {
  const n = graph.nodes.length;
  const out = new Map<string, Point>();
  if (n === 0) return out;
  const k = opts.spacing ?? 90;
  const index = new Map(graph.nodes.map((node, i) => [node.key, i]));
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const golden = Math.PI * (3 - Math.sqrt(5));
  // A ordem pelo grau põe os mais ligados no meio da espiral
  const order = graph.nodes
    .map((node, i) => ({ i, d: node.degree, key: node.key }))
    .sort((a, b) => b.d - a.d || (a.key < b.key ? -1 : 1));
  order.forEach(({ i }, rank) => {
    const r = k * 0.6 * Math.sqrt(rank + 0.5);
    xs[i] = r * Math.cos(rank * golden);
    ys[i] = r * Math.sin(rank * golden);
  });
  const edges = graph.edges.map((e) => [index.get(e.source)!, index.get(e.target)!] as const);
  const steps = n > 600 ? 40 : n > 200 ? 90 : 220;
  let temp = k * Math.sqrt(n) * 0.5;
  const cool = temp / (steps + 1);
  const dx = new Float64Array(n);
  const dy = new Float64Array(n);
  for (let step = 0; step < steps; step++) {
    dx.fill(0);
    dy.fill(0);
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        let x = xs[i] - xs[j];
        let y = ys[i] - ys[j];
        let d2 = x * x + y * y;
        if (d2 < 0.01) {
          x = 0.1 * ((i % 7) - 3) + 0.05;
          y = 0.1 * ((j % 5) - 2) + 0.05;
          d2 = x * x + y * y;
        }
        const f = (k * k) / d2;
        dx[i] += x * f;
        dy[i] += y * f;
        dx[j] -= x * f;
        dy[j] -= y * f;
      }
    for (const [a, b] of edges) {
      const x = xs[a] - xs[b];
      const y = ys[a] - ys[b];
      const d = Math.sqrt(x * x + y * y) || 0.01;
      const f = d / k;
      dx[a] -= x * f;
      dy[a] -= y * f;
      dx[b] += x * f;
      dy[b] += y * f;
    }
    for (let i = 0; i < n; i++) {
      // Um pouco de gravidade para o centro: as soltas não fogem
      dx[i] -= xs[i] * 0.02;
      dy[i] -= ys[i] * 0.02;
      const len = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 1;
      const move = Math.min(len, temp);
      xs[i] += (dx[i] / len) * move;
      ys[i] += (dy[i] / len) * move;
    }
    temp -= cool;
  }
  graph.nodes.forEach((node, i) =>
    out.set(node.key, { x: Math.round(xs[i]), y: Math.round(ys[i]) }),
  );
  return out;
}

/** A caixa que contém todos os pontos (para caber na tela) */
export function bounds(points: Iterable<Point>) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (minX === Infinity) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

/** Raio do ponto pelo grau (os mais citados ficam maiores) */
export const nodeRadius = (degree: number) => Math.min(18, 5 + Math.sqrt(degree) * 3);
