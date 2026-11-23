// HTML (texto) → árvore com a forma que o conversor do Web Clipper lê (`MdNode`, D305). Puro: roda
// na web, no celular (que não tem DOMParser) e nos testes. Tolerante como o navegador o bastante
// para material de estudo (ES5, D326): fecha <p>, <li>, <td> e <tr> sozinhos, ignora fechamento
// sem abertura, guarda o conteúdo de <script>/<style> como texto (o conversor descarta).

import type { MdNode } from './html-markdown';

const VOID = new Set([
  'AREA',
  'BASE',
  'BR',
  'COL',
  'EMBED',
  'HR',
  'IMG',
  'INPUT',
  'LINK',
  'META',
  'PARAM',
  'SOURCE',
  'TRACK',
  'WBR',
]);
const RAW = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'TITLE']);
/** Abrir um destes fecha o <p> aberto */
const CLOSES_P = new Set([
  'P',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'UL',
  'OL',
  'TABLE',
  'PRE',
  'BLOCKQUOTE',
  'HR',
  'SECTION',
  'ARTICLE',
  'HEADER',
  'FOOTER',
  'NAV',
  'ASIDE',
  'FIGURE',
  'DL',
  'ADDRESS',
  'FORM',
]);

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  copy: '©',
  reg: '®',
  deg: '°',
  middot: '·',
  times: '×',
  divide: '÷',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  sect: '§',
  para: '¶',
  bull: '•',
  prime: '′',
  Prime: '″',
  shy: '',
  thinsp: ' ',
  ensp: ' ',
  emsp: ' ',
  minus: '−',
  plusmn: '±',
  pi: 'π',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  theta: 'θ',
  lambda: 'λ',
  mu: 'μ',
  sigma: 'σ',
  omega: 'ω',
  Delta: 'Δ',
  Sigma: 'Σ',
  Omega: 'Ω',
  le: '≤',
  ge: '≥',
  ne: '≠',
  asymp: '≈',
  infin: '∞',
  radic: '√',
  sup2: '²',
  sup3: '³',
  micro: 'µ',
  iquest: '¿',
  iexcl: '¡',
  ordm: 'º',
  ordf: 'ª',
  aelig: 'æ',
  AElig: 'Æ',
  oelig: 'œ',
  OElig: 'Œ',
  szlig: 'ß',
};
const ACCENTS: Record<string, string> = {
  acute: '́',
  grave: '̀',
  circ: '̂',
  tilde: '̃',
  uml: '̈',
  cedil: '̧',
  ring: '̊',
};

export function decodeEntities(text: string): string {
  if (!text.includes('&')) return text;
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);?/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : Number(body.slice(1));
      return Number.isFinite(code) && code > 0 && code < 0x110000
        ? String.fromCodePoint(code)
        : whole;
    }
    if (body in NAMED) return NAMED[body];
    // &eacute; &Atilde; &ccedil;...: a letra com o acento combinado
    const accent = /^([a-z])(acute|grave|circ|tilde|uml|cedil|ring)$/i.exec(body);
    if (accent) return (accent[1] + ACCENTS[accent[2].toLowerCase()]).normalize('NFC');
    return whole;
  });
}

type El = MdNode & { childNodes: MdNode[]; attrs: Record<string, string> };

function textNode(text: string): MdNode {
  return { nodeType: 3, nodeName: '#text', textContent: text, childNodes: [] };
}

function element(name: string, attrs: Record<string, string>): El {
  const node: El = {
    nodeType: 1,
    nodeName: name,
    attrs,
    childNodes: [],
    get textContent() {
      return node.childNodes.map((c) => c.textContent ?? '').join('');
    },
    getAttribute: (n) => (n.toLowerCase() in attrs ? attrs[n.toLowerCase()] : null),
  };
  return node;
}

const ATTR = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

function parseAttrs(source: string) {
  const attrs: Record<string, string> = {};
  for (const m of source.matchAll(ATTR))
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  return attrs;
}

/** A árvore do documento; devolve o <body> (ou a raiz, se não houver) */
export function parseHtml(html: string): MdNode {
  const root = element('#ROOT', {});
  const stack: El[] = [root];
  const top = () => stack[stack.length - 1];
  const closeTo = (name: string) => {
    for (let i = stack.length - 1; i > 0; i--)
      if (stack[i].nodeName === name) {
        stack.length = i;
        return true;
      }
    return false;
  };
  const openIn = (names: string[], stopAt: string[]) => {
    for (let i = stack.length - 1; i > 0; i--) {
      if (names.includes(stack[i].nodeName)) return i;
      if (stopAt.includes(stack[i].nodeName)) return -1;
    }
    return -1;
  };

  const tag =
    /<!--[\s\S]*?-->|<![^>]*>|<\?[^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(html))) {
    if (m.index > last) top().childNodes.push(textNode(decodeEntities(html.slice(last, m.index))));
    last = tag.lastIndex;
    if (m[1]) {
      closeTo(m[1].toUpperCase());
      continue;
    }
    if (!m[2]) continue; // comentário, doctype
    const name = m[2].toUpperCase();
    const rawAttrs = m[3] ?? '';
    if (CLOSES_P.has(name)) {
      const p = openIn(['P'], ['BUTTON', 'TD', 'TH', 'LI', 'BLOCKQUOTE', 'DIV']);
      if (p > 0) stack.length = p;
    }
    if (name === 'LI') {
      const li = openIn(['LI'], ['UL', 'OL']);
      if (li > 0) stack.length = li;
    }
    if (name === 'TD' || name === 'TH') {
      const cell = openIn(['TD', 'TH'], ['TR', 'TABLE']);
      if (cell > 0) stack.length = cell;
    }
    if (name === 'TR') {
      const row = openIn(['TR'], ['TABLE']);
      if (row > 0) stack.length = row;
    }
    if (name === 'DT' || name === 'DD') {
      const item = openIn(['DT', 'DD'], ['DL']);
      if (item > 0) stack.length = item;
    }
    const node = element(name, parseAttrs(rawAttrs));
    // O <title> é do documento, não do texto (htmlTitle lê à parte)
    if (name !== 'TITLE') top().childNodes.push(node);
    if (RAW.has(name)) {
      const end = html.toLowerCase().indexOf(`</${name.toLowerCase()}`, last);
      const stop = end < 0 ? html.length : end;
      const inner = html.slice(last, stop);
      node.childNodes.push(
        textNode(name === 'TITLE' || name === 'TEXTAREA' ? decodeEntities(inner) : inner),
      );
      const close = html.indexOf('>', stop);
      last = end < 0 ? html.length : close < 0 ? html.length : close + 1;
      tag.lastIndex = last;
      continue;
    }
    if (VOID.has(name) || /\/\s*$/.test(rawAttrs)) continue;
    stack.push(node);
  }
  if (last < html.length) top().childNodes.push(textNode(decodeEntities(html.slice(last))));
  return find(root, 'BODY') ?? root;
}

function find(node: MdNode, name: string): MdNode | null {
  for (const c of Array.from(node.childNodes)) {
    if (c.nodeName === name) return c;
    if (c.nodeType === 1) {
      const hit = find(c, name);
      if (hit) return hit;
    }
  }
  return null;
}

/** O <title> do documento (vazio se não houver) */
export function htmlTitle(html: string): string {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : '';
}
