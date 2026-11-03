// Links [[...]] entre anotações, tarefas, listas e pastas (OB1, OB2, D286). A marcação fica no
// texto e guarda o id: [[Título|n:<id>]] (n: anotação, t: tarefa, p: lista, f: pasta ou projeto),
// com âncora [[Título#Seção|n:<id>]]; [[Título]] (ou [[Título|apelido]], como no Obsidian) é link
// para o que ainda não existe, e ![[...]] incorpora (OB6). Espelho do reconhecimento do servidor
// (`public._refresh_links` e `_link_context`, migração 20261188000000_links.sql): mudou a regra,
// mude os dois, com os mesmos casos nos dois testes. Funções puras.

export type LinkKind = 'note' | 'task' | 'page' | 'folder';
export type WikiLink = {
  start: number;
  end: number;
  embed: boolean;
  title: string;
  anchor: string | null;
  /** O texto depois do "|" quando não é um id (o apelido do Obsidian) */
  alias: string | null;
  kind: LinkKind | null;
  id: string | null;
};

const PREFIX: Record<LinkKind, string> = { note: 'n', task: 't', page: 'p', folder: 'f' };
const KIND: Record<string, LinkKind> = { n: 'note', t: 'task', p: 'page', f: 'folder' };
const LINK = /(!?)\[\[([^[\]|#\n]+)(?:#([^[\]|\n]+))?(?:\|([^[\]\n]*))?\]\]/g;
const REF = /^([ntpf]):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
/** O servidor para nisso também */
export const MAX_LINKS = 300;

export function parseLinks(text: string): WikiLink[] {
  const out: WikiLink[] = [];
  if (!text.includes('[[')) return out;
  for (const m of text.matchAll(LINK)) {
    const title = m[2].trim();
    if (!title) continue;
    if (out.length >= MAX_LINKS) break;
    const ref = (m[4] ?? '').trim();
    const id = REF.exec(ref);
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      embed: m[1] === '!',
      title: title.slice(0, 200),
      anchor: m[3]?.trim() ? m[3].trim().slice(0, 200) : null,
      alias: !id && ref ? ref : null,
      kind: id ? KIND[id[1].toLowerCase()] : null,
      id: id ? id[2].toLowerCase() : null,
    });
  }
  return out;
}

/** Título que cabe na marcação: sem colchetes, "|", "#" nem quebra de linha */
export function cleanLinkTitle(title: string) {
  return (
    title
      .replace(/[[\]|#\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200) || '…'
  );
}

export function linkMarkup(title: string, kind: LinkKind, id: string, anchor?: string | null) {
  const section = anchor ? `#${cleanLinkTitle(anchor)}` : '';
  return `[[${cleanLinkTitle(title)}${section}|${PREFIX[kind]}:${id}]]`;
}

/** A linha em volta do link, sem a marcação (a frase do "Citado em"), igual à do servidor */
export function linkContext(line: string) {
  return line
    .replace(LINK, '$2')
    .replace(/^\s*([-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+|#{1,6}\s+|>\s*)/, '')
    .trim()
    .slice(0, 240);
}

/**
 * O "[[" aberto antes do cursor, na mesma linha, para o autocomplete: devolve onde começa e o que
 * já foi digitado. Fechado (]]), com "|" ou numa linha anterior não conta.
 */
export function linkQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const open = before.lastIndexOf('[[');
  if (open < 0) return null;
  const query = before.slice(open + 2);
  if (/[\n[\]|]/.test(query) || query.length > 80) return null;
  return { start: open, query };
}

/** Troca o "[[consulta" (de `start` ao cursor) pelo link escolhido; come o "]]" que já estava lá */
export function applyLink(text: string, start: number, caret: number, markup: string) {
  let after = text.slice(caret);
  if (after.startsWith(']]')) after = after.slice(2);
  return { text: text.slice(0, start) + markup + after, caret: start + markup.length };
}

const SCHEME = 'questlist-link:';
export type LinkHref =
  | { kind: LinkKind; id: string; anchor: string | null }
  | { kind: 'new'; title: string; anchor: string | null }
  | { kind: 'none' };

/** O destino ainda existe e a pessoa o vê? `null`: sem acesso (ou apagado); `undefined`: não sabe ainda */
export type ResolveLink = (kind: LinkKind, id: string) => string | null | undefined;

const escapeLabel = (label: string) => label.replace(/([\\`*_~<>[\]])/g, '\\$1');

/**
 * Para mostrar formatado: cada [[...]] vira um link do Markdown com o endereço `questlist-link:`,
 * que a anotação abre por dentro do app. O texto do link é o apelido, o título de agora (renomear
 * não quebra) ou "(sem acesso)". Dentro de código (```, `) fica como está.
 */
export function wikiToMarkdown(text: string, resolve: ResolveLink, noAccess: string): string {
  if (!text.includes('[[')) return text;
  // Separa o código (cercas e `inline`) e só troca fora dele
  return text
    .split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g)
    .map((part, i) => (i % 2 === 1 ? part : replaceLinks(part, resolve, noAccess)))
    .join('');
}

function replaceLinks(text: string, resolve: ResolveLink, noAccess: string) {
  return text.replace(
    LINK,
    (whole, _embed: string, rawTitle: string, rawAnchor?: string, rawRef?: string) => {
      const title = rawTitle.trim();
      if (!title) return whole;
      const anchor = rawAnchor?.trim() || null;
      const section = anchor ? `#${encodeURIComponent(anchor)}` : '';
      const ref = REF.exec((rawRef ?? '').trim());
      const alias = !ref && rawRef?.trim() ? rawRef.trim() : null;
      if (!ref) {
        const label = alias ?? (anchor ? `${title} › ${anchor}` : title);
        return `[${escapeLabel(label)}](${SCHEME}new:${encodeURIComponent(title)}${section})`;
      }
      const kind = KIND[ref[1].toLowerCase()];
      const id = ref[2].toLowerCase();
      const current = resolve(kind, id);
      if (current === null) return `[${escapeLabel(noAccess)}](${SCHEME}none:)`;
      const name = current || title;
      const label = anchor ? `${name} › ${anchor}` : name;
      return `[${escapeLabel(label)}](${SCHEME}${PREFIX[kind]}:${id}${section})`;
    },
  );
}

export function parseLinkHref(raw: string): LinkHref | null {
  // O react-native-marked só reconhece esquema de letras (sem o "-"): chega como caminho relativo
  const href = raw.startsWith(`/${SCHEME}`) ? raw.slice(1) : raw;
  if (!href.startsWith(SCHEME)) return null;
  const rest = href.slice(SCHEME.length);
  const hash = rest.indexOf('#');
  const body = hash < 0 ? rest : rest.slice(0, hash);
  const anchor = hash < 0 ? null : decodeURIComponent(rest.slice(hash + 1)) || null;
  const colon = body.indexOf(':');
  const prefix = body.slice(0, colon);
  const value = body.slice(colon + 1);
  if (prefix === 'none') return { kind: 'none' };
  if (prefix === 'new') return { kind: 'new', title: decodeURIComponent(value), anchor };
  const kind = KIND[prefix];
  return kind && value ? { kind, id: value, anchor } : null;
}

const fold = (s: string) => s.toLocaleLowerCase().normalize('NFC');

/**
 * Depois de criar a anotação de um link que não existia: os [[Título]] sem id (com âncora ou
 * apelido) que batem com o título ganham o id, para o "Citado em" achar e renomear não quebrar.
 */
export function resolveTitleLinks(text: string, title: string, kind: LinkKind, id: string) {
  const key = fold(title.trim());
  let out = '';
  let last = 0;
  for (const link of parseLinks(text)) {
    if (link.id || fold(link.title) !== key) continue;
    const section = link.anchor ? `#${link.anchor}` : '';
    out +=
      text.slice(last, link.start) +
      `${link.embed ? '!' : ''}[[${link.title}${section}|${PREFIX[kind]}:${id}]]`;
    last = link.end;
  }
  return last ? out + text.slice(last) : text;
}

// Letra ou número em qualquer língua (sem \p{L}, que nem todo motor de JS do celular aceita)
const isWordChar = (c: string | undefined) =>
  !!c && (c.toLowerCase() !== c.toUpperCase() || /[0-9_]/.test(c));

/** Onde o título aparece escrito sem link (palavra inteira, sem diferença de maiúsculas), ou -1 */
export function findMention(text: string, title: string): number {
  const key = fold(title.trim());
  if (key.length < 2) return -1;
  // Tira os links do caminho, mantendo as posições
  let masked = text;
  for (const link of parseLinks(text))
    masked =
      masked.slice(0, link.start) + ' '.repeat(link.end - link.start) + masked.slice(link.end);
  const hay = fold(masked);
  if (hay.length !== masked.length) return -1;
  let from = 0;
  while (from <= hay.length) {
    const at = hay.indexOf(key, from);
    if (at < 0) return -1;
    if (!isWordChar(masked[at - 1]) && !isWordChar(masked[at + key.length])) return at;
    from = at + 1;
  }
  return -1;
}

/** "Ligar" uma menção sem link: a primeira vira [[como estava escrito|k:id]] */
export function linkMention(text: string, title: string, kind: LinkKind, id: string) {
  const at = findMention(text, title);
  if (at < 0) return text;
  const written = text.slice(at, at + title.trim().length);
  return text.slice(0, at) + linkMarkup(written, kind, id) + text.slice(at + written.length);
}

/** Âncora de título: compara sem maiúsculas, acentos de formatação nem pontuação */
export function headingKey(text: string) {
  return fold(text)
    .replace(/[*_`~#[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Os títulos do Markdown, na ordem (fora das cercas de código), para rolar até a âncora */
export function headings(text: string): string[] {
  const out: string[] = [];
  let fence = false;
  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) fence = !fence;
    else if (!fence) {
      const m = /^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
      if (m) out.push(m[1].replace(LINK, '$2'));
    }
  }
  return out;
}
