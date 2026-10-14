import { nameKey } from './members';

// "^trecho" e "^2" da captura e do lote (V3 §2.5): de qual tarefa a nova depende.

export type PrereqCandidate = { id: string; title: string };
export type PrereqResolution =
  | { kind: 'task'; term: string; id: string; title: string }
  | { kind: 'none'; term: string }
  | { kind: 'ambiguous'; term: string; candidates: PrereqCandidate[] };

/** Título inteiro (sem espaço nem acento) vence; senão, o trecho tem que achar uma tarefa só. */
export function resolvePrereq(
  term: string,
  candidates: readonly PrereqCandidate[],
): PrereqResolution {
  const key = nameKey(term);
  if (!key) return { kind: 'none', term };
  const exact = candidates.filter((c) => nameKey(c.title) === key);
  const found = exact.length ? exact : candidates.filter((c) => nameKey(c.title).includes(key));
  if (found.length === 1) return { kind: 'task', term, id: found[0].id, title: found[0].title };
  if (found.length === 0) return { kind: 'none', term };
  return { kind: 'ambiguous', term, candidates: found };
}

/**
 * No lote: "^2" é o item 2 (contando de 1, na ordem do lote); "^trecho" procura primeiro nos itens
 * do lote e depois nas tarefas do projeto. O próprio item não conta.
 */
export function resolveBatchPrereq(
  term: string,
  self: string,
  batch: readonly PrereqCandidate[],
  project: readonly PrereqCandidate[],
): PrereqResolution {
  if (/^\d+$/.test(term)) {
    const item = batch[Number(term) - 1];
    return item && item.id !== self
      ? { kind: 'task', term, id: item.id, title: item.title }
      : { kind: 'none', term };
  }
  const others = batch.filter((b) => b.id !== self);
  const inBatch = resolvePrereq(term, others);
  return inBatch.kind === 'none' ? resolvePrereq(term, project) : inBatch;
}

/** Como escrever a tarefa depois do "^" para achar só ela: o título sem espaços. */
export const prereqToken = (title: string) => title.replace(/[^\p{L}\p{N}._-]+/gu, '');
