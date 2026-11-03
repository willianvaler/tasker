// Canvas (OB10, ESCOPO_V11 §6, D295): o quadro branco infinito, guardado em `pages.config` no
// formato aberto JSON Canvas (jsoncanvas.org, MIT). Cartões de verdade (anotação, tarefa, lista,
// pasta) são nós "file" com `file` = "<prefixo>:<id>" (os prefixos do [[link]], OB1): a tarefa no
// canvas é a mesma tarefa. Funções puras, com testes.

import type { LinkKind } from './wikilinks';

export type CanvasColor = '1' | '2' | '3' | '4' | '5' | '6';
export const CANVAS_COLORS: CanvasColor[] = ['1', '2', '3', '4', '5', '6'];
export type CanvasSide = 'top' | 'right' | 'bottom' | 'left';

export type CanvasNode = {
  id: string;
  type: 'text' | 'file' | 'link' | 'group';
  x: number;
  y: number;
  width: number;
  height: number;
  color?: CanvasColor;
  /** text: o texto (Markdown) */
  text?: string;
  /** file: o cartão de verdade ("n:<id>") ou, vindo de fora, o nome do arquivo */
  file?: string;
  /** link: o endereço (imagem mostra a imagem) */
  url?: string;
  /** group: o nome do grupo */
  label?: string;
};
export type CanvasEdge = {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide?: CanvasSide;
  toSide?: CanvasSide;
  label?: string;
  color?: CanvasColor;
};
export type Canvas = { nodes: CanvasNode[]; edges: CanvasEdge[] };

export const MAX_NODES = 2000;
export const MAX_EDGES = 5000;
const MAX_TEXT = 5000;
export const EMPTY_CANVAS: Canvas = { nodes: [], edges: [] };

/** Tamanho padrão de cada tipo de cartão */
export const NODE_SIZE: Record<
  'text' | 'card' | 'link' | 'group',
  { width: number; height: number }
> = {
  text: { width: 240, height: 120 },
  card: { width: 260, height: 100 },
  link: { width: 280, height: 180 },
  group: { width: 520, height: 360 },
};

const PREFIX: Record<string, LinkKind> = { n: 'note', t: 'task', p: 'page', f: 'folder' };
const LETTER: Record<LinkKind, string> = { note: 'n', task: 't', page: 'p', folder: 'f' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O item de verdade do cartão "file" ("n:<id>" → anotação), ou null */
export function cardRef(
  node: Pick<CanvasNode, 'type' | 'file'>,
): { kind: LinkKind; id: string } | null {
  if (node.type !== 'file' || !node.file) return null;
  const m = /^([ntpf]):(.+)$/.exec(node.file);
  if (!m || !UUID.test(m[2])) return null;
  return { kind: PREFIX[m[1]], id: m[2] };
}
export const cardFile = (kind: LinkKind, id: string) => `${LETTER[kind]}:${id}`;

const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
const str = (v: unknown, max = MAX_TEXT) => (typeof v === 'string' ? v.slice(0, max) : undefined);
const color = (v: unknown): CanvasColor | undefined =>
  typeof v === 'string' && (CANVAS_COLORS as string[]).includes(v) ? (v as CanvasColor) : undefined;
const side = (v: unknown): CanvasSide | undefined =>
  v === 'top' || v === 'right' || v === 'bottom' || v === 'left' ? v : undefined;
const clean = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** Lê o JSON guardado (ou importado), descartando o que não vale; seta sem ponta some */
export function readCanvas(raw: unknown): Canvas {
  const o =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const nodes: CanvasNode[] = [];
  const ids = new Set<string>();
  for (const n of Array.isArray(o.nodes) ? o.nodes : []) {
    if (!n || typeof n !== 'object' || nodes.length >= MAX_NODES) continue;
    const r = n as Record<string, unknown>;
    const id = str(r.id, 100);
    const type = r.type;
    if (
      !id ||
      ids.has(id) ||
      (type !== 'text' && type !== 'file' && type !== 'link' && type !== 'group')
    )
      continue;
    ids.add(id);
    nodes.push(
      clean({
        id,
        type,
        x: num(r.x, 0),
        y: num(r.y, 0),
        width: Math.max(40, num(r.width, NODE_SIZE.text.width)),
        height: Math.max(30, num(r.height, NODE_SIZE.text.height)),
        color: color(r.color),
        text: type === 'text' ? (str(r.text) ?? '') : undefined,
        file: type === 'file' ? str(r.file, 500) : undefined,
        url: type === 'link' ? str(r.url, 2000) : undefined,
        label: type === 'group' ? str(r.label, 200) : undefined,
      }),
    );
  }
  const edges: CanvasEdge[] = [];
  const edgeIds = new Set<string>();
  for (const e of Array.isArray(o.edges) ? o.edges : []) {
    if (!e || typeof e !== 'object' || edges.length >= MAX_EDGES) continue;
    const r = e as Record<string, unknown>;
    const id = str(r.id, 100);
    const from = str(r.fromNode, 100);
    const to = str(r.toNode, 100);
    if (!id || !from || !to || edgeIds.has(id) || !ids.has(from) || !ids.has(to) || from === to)
      continue;
    edgeIds.add(id);
    edges.push(
      clean({
        id,
        fromNode: from,
        toNode: to,
        fromSide: side(r.fromSide),
        toSide: side(r.toSide),
        label: str(r.label, 200) || undefined,
        color: color(r.color),
      }),
    );
  }
  return { nodes, edges };
}

/** Onde pôr um cartão novo: à direita do que já existe (ou no ponto pedido) */
export function placeNew(
  canvas: Canvas,
  size: { width: number; height: number },
  at?: { x: number; y: number },
): { x: number; y: number } {
  if (at) return { x: Math.round(at.x - size.width / 2), y: Math.round(at.y - size.height / 2) };
  const free = canvas.nodes.filter((n) => n.type !== 'group');
  const list = free.length ? free : canvas.nodes;
  if (!list.length) return { x: 0, y: 0 };
  const right = Math.max(...list.map((n) => n.x + n.width));
  const top = Math.min(...list.map((n) => n.y));
  return { x: right + 40, y: top };
}

export function addNode(canvas: Canvas, node: CanvasNode): Canvas {
  if (canvas.nodes.length >= MAX_NODES || canvas.nodes.some((n) => n.id === node.id)) return canvas;
  // Grupo vai para trás (desenhado antes); o resto, na frente
  return {
    ...canvas,
    nodes: node.type === 'group' ? [node, ...canvas.nodes] : [...canvas.nodes, node],
  };
}

export function updateNode(
  canvas: Canvas,
  id: string,
  patch: Partial<Omit<CanvasNode, 'id' | 'type'>>,
): Canvas {
  return {
    ...canvas,
    nodes: canvas.nodes.map((n) => (n.id === id ? clean({ ...n, ...patch }) : n)),
  };
}

/** Tira os cartões e as setas presas a eles */
export function removeNodes(canvas: Canvas, ids: readonly string[]): Canvas {
  const gone = new Set(ids);
  return {
    nodes: canvas.nodes.filter((n) => !gone.has(n.id)),
    edges: canvas.edges.filter((e) => !gone.has(e.fromNode) && !gone.has(e.toNode)),
  };
}

/** Seta nova; repetida (mesmo par, mesmo sentido) ou para si mesmo, não */
export function addEdge(canvas: Canvas, edge: CanvasEdge): Canvas {
  const ids = new Set(canvas.nodes.map((n) => n.id));
  if (
    edge.fromNode === edge.toNode ||
    !ids.has(edge.fromNode) ||
    !ids.has(edge.toNode) ||
    canvas.edges.length >= MAX_EDGES ||
    canvas.edges.some((e) => e.fromNode === edge.fromNode && e.toNode === edge.toNode)
  )
    return canvas;
  return { ...canvas, edges: [...canvas.edges, clean(edge)] };
}

export function updateEdge(
  canvas: Canvas,
  id: string,
  patch: Partial<Omit<CanvasEdge, 'id'>>,
): Canvas {
  return {
    ...canvas,
    edges: canvas.edges.map((e) =>
      e.id === id
        ? clean({
            ...e,
            ...patch,
            label: patch.label === '' ? undefined : (patch.label ?? e.label),
          })
        : e,
    ),
  };
}

export function removeEdges(canvas: Canvas, ids: readonly string[]): Canvas {
  const gone = new Set(ids);
  return { ...canvas, edges: canvas.edges.filter((e) => !gone.has(e.id)) };
}

/** O grupo de cada cartão: o menor grupo que o contém inteiro */
export function groupOf(canvas: Canvas, node: CanvasNode): CanvasNode | null {
  let best: CanvasNode | null = null;
  for (const g of canvas.nodes) {
    if (g.type !== 'group' || g.id === node.id) continue;
    const inside =
      node.x >= g.x &&
      node.y >= g.y &&
      node.x + node.width <= g.x + g.width &&
      node.y + node.height <= g.y + g.height;
    if (inside && (!best || g.width * g.height < best.width * best.height)) best = g;
  }
  return best;
}

/** Endereço que é imagem (o cartão "link" mostra a imagem em vez do endereço) */
export const isImageUrl = (url: string | undefined) =>
  !!url && /^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg|avif)(\?\S*)?$/i.test(url);

export const isWebUrl = (url: string) => /^https?:\/\/\S+$/i.test(url.trim());

/**
 * Exporta para um arquivo .canvas que outros apps abrem: anotação vira arquivo "<Título>.md";
 * tarefa, lista e pasta (que só existem aqui) viram texto com o nome.
 */
export function exportCanvas(
  canvas: Canvas,
  titleOf: (kind: LinkKind, id: string) => string | null | undefined,
  check: (id: string) => boolean | undefined,
): string {
  const nodes = canvas.nodes.map((n) => {
    const ref = cardRef(n);
    if (!ref) return n;
    const title = titleOf(ref.kind, ref.id) ?? '';
    const { file: _file, ...rest } = n;
    if (ref.kind === 'note' && title)
      return { ...rest, file: `${title.replace(/[\\/:*?"<>|]/g, '-')}.md` };
    // Tarefa vira caixinha do Markdown quando se sabe se está feita
    const done = ref.kind === 'task' ? check(ref.id) : undefined;
    const mark = done === undefined ? '' : done ? '- [x] ' : '- [ ] ';
    return { ...rest, type: 'text' as const, text: `${mark}${title}` };
  });
  return JSON.stringify({ nodes, edges: canvas.edges }, null, 2);
}

/**
 * Importa um .canvas: texto, grupo e endereço entram como estão; arquivo .md com o nome de uma
 * anotação vira o cartão dela; o resto vira texto com o nome do arquivo. Os ids ganham prefixo
 * novo para não colidir com o que já está no canvas.
 */
export function importCanvas(
  json: string,
  noteByTitle: (title: string) => string | null | undefined,
  prefix: string,
): Canvas | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Canvas).nodes)) return null;
  const read = readCanvas(raw);
  const id = (old: string) => `${prefix}${old}`;
  return {
    nodes: read.nodes.map((n) => {
      const node = { ...n, id: id(n.id) };
      if (n.type !== 'file' || cardRef(n)) return node;
      const name = (n.file ?? '').split('/').pop() ?? '';
      const title = name.replace(/\.md$/i, '');
      const note = /\.md$/i.test(name) ? noteByTitle(title) : null;
      if (note) return { ...node, file: cardFile('note', note) };
      const { file: _file, ...rest } = node;
      return { ...rest, type: 'text' as const, text: name };
    }),
    edges: read.edges.map((e) => ({
      ...e,
      id: id(e.id),
      fromNode: id(e.fromNode),
      toNode: id(e.toNode),
    })),
  };
}

/** Junta o importado ao canvas, à direita do que já existe */
export function mergeCanvas(base: Canvas, extra: Canvas): Canvas {
  if (!extra.nodes.length) return base;
  const minX = Math.min(...extra.nodes.map((n) => n.x));
  const minY = Math.min(...extra.nodes.map((n) => n.y));
  const at = base.nodes.length ? placeNew(base, { width: 0, height: 0 }) : { x: minX, y: minY };
  const dx = at.x - minX;
  const dy = at.y - minY;
  const moved = extra.nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
  const groups = moved.filter((n) => n.type === 'group');
  const rest = moved.filter((n) => n.type !== 'group');
  return readCanvas({
    nodes: [...groups, ...base.nodes, ...rest],
    edges: [...base.edges, ...extra.edges],
  });
}
