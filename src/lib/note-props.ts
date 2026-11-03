// Propriedades e etiquetas das anotações (OB4, ESCOPO_V11 §3, D289). Funções puras, com testes.
// `noteTags` é o espelho de public.note_tags (mesmos casos no pgTAP propriedades_anotacoes).

export type PropValue = string | number | boolean | string[] | null;
export type NoteProps = Record<string, PropValue>;
export type PropType = 'text' | 'number' | 'date' | 'checkbox' | 'list' | 'link';
export const PROP_TYPES: PropType[] = ['text', 'number', 'date', 'checkbox', 'list', 'link'];

/** Propriedades com sentido próprio (como no Obsidian) */
export const TAGS_PROP = 'tags';
export const ALIASES_PROP = 'aliases';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LINK = /^\[\[[^\]]+\]\]$/;

/** Uma etiqueta limpa (sem "#", minúscula, sem "/" sobrando), ou null se não tiver letra */
export function cleanTag(raw: string): string | null {
  const tag = raw
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\s+/g, '-');
  return /\p{L}/u.test(tag) && tag.length <= 60 ? tag : null;
}

/** O "#etiqueta" no texto: no começo da linha ou depois de um espaço */
export const TAG_IN_TEXT = /(^|\s)#([\p{L}\p{N}_/-]+)/gu;

/** Etiquetas da anotação: a propriedade `tags` primeiro, depois as do texto (fora do código) */
export function noteTags(body: string, props: NoteProps | null | undefined): string[] {
  const out: string[] = [];
  const add = (raw: string) => {
    const tag = cleanTag(raw);
    if (tag && !out.includes(tag)) out.push(tag);
  };
  const prop = props?.[TAGS_PROP];
  if (Array.isArray(prop)) for (const item of prop) if (typeof item === 'string') add(item);
  if (typeof prop === 'string') prop.split(',').forEach(add);
  let fence = false;
  for (const line of (body ?? '').split('\n')) {
    if (/^\s*```/.test(line)) {
      fence = !fence;
      continue;
    }
    if (fence || !line.includes('#')) continue;
    for (const m of line.replace(/`[^`]*`/g, ' ').matchAll(TAG_IN_TEXT)) add(m[2]);
  }
  return out.slice(0, 100);
}

/** Outros nomes da anotação (propriedade `aliases`, lista ou texto com vírgula) */
export function noteAliases(props: NoteProps | null | undefined): string[] {
  const value = props?.[ALIASES_PROP];
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return list.map((a) => a.trim()).filter(Boolean);
}

/** O tipo pelo valor guardado (o banco guarda só o valor, como o frontmatter) */
export function propType(value: PropValue): PropType {
  if (typeof value === 'boolean') return 'checkbox';
  if (typeof value === 'number') return 'number';
  if (Array.isArray(value)) return 'list';
  if (typeof value === 'string' && DATE.test(value)) return 'date';
  if (typeof value === 'string' && LINK.test(value.trim())) return 'link';
  return 'text';
}

/** Muda o tipo de uma propriedade aproveitando o valor quando dá */
export function convertProp(value: PropValue, to: PropType): PropValue {
  const text = Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value);
  switch (to) {
    case 'checkbox':
      return typeof value === 'boolean'
        ? value
        : ['true', 'sim', 'yes', 'sí', 'si', '1'].includes(text.toLowerCase());
    case 'number': {
      const n = Number(text.replace(',', '.'));
      return text.trim() && Number.isFinite(n) ? n : null;
    }
    case 'list':
      return Array.isArray(value)
        ? value
        : text
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    case 'date':
      return DATE.test(text) ? text : '';
    case 'link':
      return LINK.test(text.trim()) ? text.trim() : text.trim() ? `[[${text.trim()}]]` : '';
    case 'text':
      return text;
  }
}

/** Nome de propriedade aceito: curto, sem quebra de linha nem ":" (vira frontmatter no OB13) */
export function cleanPropName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 40 || /[:\n]/.test(name)) return null;
  return name;
}

/** As propriedades em ordem para mostrar: tags e aliases primeiro, o resto pelo nome */
export function propEntries(props: NoteProps | null | undefined): [string, PropValue][] {
  const rank = (k: string) => (k === TAGS_PROP ? 0 : k === ALIASES_PROP ? 1 : 2);
  return Object.entries(props ?? {}).sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}

/** A etiqueta `filtro` vale para `tag` (ela mesma ou uma filha: #treino acha #treino/perna) */
export function tagMatches(tag: string, filter: string) {
  return tag === filter || tag.startsWith(`${filter}/`);
}

export type TagNode = { tag: string; name: string; count: number; children: TagNode[] };

/**
 * Árvore das etiquetas aninhadas (`treino/perna` fica dentro de `treino`); `count` soma o item em
 * cada nível uma vez só. Entra a lista de etiquetas de cada item (anotação ou tarefa).
 */
export function tagTree(items: string[][]): TagNode[] {
  const counts = new Map<string, number>();
  for (const tags of items) {
    const seen = new Set<string>();
    for (const tag of tags) {
      const parts = tag.split('/');
      for (let i = 1; i <= parts.length; i++) seen.add(parts.slice(0, i).join('/'));
    }
    for (const tag of seen) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const nodes = new Map<string, TagNode>();
  const roots: TagNode[] = [];
  for (const tag of [...counts.keys()].sort()) {
    const cut = tag.lastIndexOf('/');
    const node: TagNode = { tag, name: tag.slice(cut + 1), count: counts.get(tag)!, children: [] };
    nodes.set(tag, node);
    const parent = cut > 0 ? nodes.get(tag.slice(0, cut)) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  return roots;
}
