// Busca com operadores da paleta (OB12, ESCOPO_V11 §7, D297): palavras soltas, "frase exata",
// -palavra (fica de fora), tag:etiqueta (ou #etiqueta), em:pasta e tipo:nota|tarefa|lista|pasta.
// Os operadores valem nos três idiomas ao mesmo tempo, como a linguagem de consulta (D292), e a
// comparação é sem acento. Funções puras, com testes.

import { cleanTag, tagMatches } from './note-props';
import { fold } from './query/parse';

export type SearchKind = 'note' | 'task' | 'page' | 'folder';

export type ParsedSearch = {
  words: string[];
  phrases: string[];
  exclude: string[];
  tags: string[];
  folders: string[];
  kinds: SearchKind[];
};

const OPERATORS: Record<string, 'tag' | 'folder' | 'kind'> = {};
for (const w of ['tag', 'etiqueta', 'label']) OPERATORS[w] = 'tag';
for (const w of ['em', 'in', 'en', 'pasta', 'folder', 'carpeta', 'projeto', 'project', 'proyecto'])
  OPERATORS[w] = 'folder';
for (const w of ['tipo', 'type', 'kind']) OPERATORS[w] = 'kind';

const KINDS: Record<string, SearchKind> = {};
for (const w of ['nota', 'notas', 'note', 'notes', 'anotacao', 'anotacoes']) KINDS[w] = 'note';
for (const w of ['tarefa', 'tarefas', 'task', 'tasks', 'tarea', 'tareas']) KINDS[w] = 'task';
for (const w of ['lista', 'listas', 'list', 'lists', 'pagina', 'page']) KINDS[w] = 'page';
for (const w of ['pasta', 'pastas', 'folder', 'folders', 'carpeta', 'carpetas', 'projeto', 'project', 'proyecto'])
  KINDS[w] = 'folder';

// -? (operador:)? ("frase" | palavra)
const TOKEN = /(-?)(?:([\p{L}]+):)?(?:"([^"]*)"?|(\S+))/gu;

export function parseSearch(text: string): ParsedSearch {
  const out: ParsedSearch = { words: [], phrases: [], exclude: [], tags: [], folders: [], kinds: [] };
  for (const m of text.matchAll(TOKEN)) {
    const negative = m[1] === '-';
    const op = m[2] ? OPERATORS[fold(m[2])] : undefined;
    const quoted = m[3] !== undefined;
    // "palavra:" que não é operador volta a ser texto (ex.: "Reunião: pauta")
    const raw = (m[2] && !op ? `${m[2]}:` : '') + (m[3] ?? m[4] ?? '');
    const value = fold(raw.trim());
    if (!value) continue;
    if (op === 'tag' || (!op && !quoted && value.startsWith('#') && value.length > 1)) {
      const tag = cleanTag(value);
      if (tag && !negative) out.tags.push(tag);
      else if (tag) out.exclude.push(`#${tag}`);
    } else if (op === 'folder') {
      out.folders.push(value);
    } else if (op === 'kind') {
      const kind = KINDS[value];
      if (kind && !out.kinds.includes(kind)) out.kinds.push(kind);
    } else if (negative) {
      out.exclude.push(value);
    } else if (quoted || value.includes(' ')) {
      out.phrases.push(value);
    } else {
      out.words.push(value);
    }
  }
  return out;
}

export const isEmptySearch = (q: ParsedSearch) =>
  !q.words.length &&
  !q.phrases.length &&
  !q.exclude.length &&
  !q.tags.length &&
  !q.folders.length &&
  !q.kinds.length;

/** Tem algum operador (aí a paleta procura só nos itens, sem os comandos) */
export const hasOperators = (q: ParsedSearch) =>
  q.phrases.length + q.exclude.length + q.tags.length + q.folders.length + q.kinds.length > 0;

export type SearchItem = {
  kind: SearchKind;
  title: string;
  /** Texto além do título (o corpo da anotação, as notas da tarefa) */
  text?: string | null;
  tags?: readonly string[] | null;
  /** Nomes da pasta e das de cima (a raiz conta: em:casa acha o que está em Casa/Cozinha) */
  folders?: readonly string[];
};

export function matchSearch(q: ParsedSearch, item: SearchItem): boolean {
  if (q.kinds.length && !q.kinds.includes(item.kind)) return false;
  const tags = (item.tags ?? []).map((t) => cleanTag(t)).filter((t): t is string => !!t);
  if (q.tags.some((want) => !tags.some((tag) => tagMatches(tag, want)))) return false;
  if (q.folders.length) {
    const names = (item.folders ?? []).map(fold);
    if (q.folders.some((want) => !names.some((n) => n.includes(want)))) return false;
  }
  const hay = fold(`${item.title}\n${item.text ?? ''}`);
  if (q.words.some((w) => !hay.includes(w))) return false;
  if (q.phrases.some((p) => !hay.includes(p))) return false;
  for (const ex of q.exclude) {
    if (ex.startsWith('#') ? tags.some((t) => tagMatches(t, ex.slice(1))) : hay.includes(ex))
      return false;
  }
  return true;
}

/** Ordem: título que começa com a busca, depois título que contém, depois só no texto */
export function searchRank(q: ParsedSearch, item: SearchItem): number {
  const title = fold(item.title);
  const first = q.words[0] ?? q.phrases[0];
  if (!first) return 1;
  if (title.startsWith(first)) return 0;
  if (title.includes(first)) return 1;
  return 2;
}

/** Um item ao acaso (a anotação aleatória); `random` é trocável nos testes */
export function pickRandom<T>(list: readonly T[], random: () => number = Math.random): T | undefined {
  if (!list.length) return undefined;
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}
