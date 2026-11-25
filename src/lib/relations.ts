// Propriedades tipadas, relações e rollups das bases (ED3, ESCOPO_V16, D359). O esquema mora na
// configuração da base (`pages.config.schema`); o valor continua nas propriedades da anotação, como
// no frontmatter (a relação é uma lista de `[[Título|n:<id>]]`, que qualquer leitor de Markdown
// entende). O rollup é calculado na tela, como a fórmula (D318): nunca é gravado, então não entra
// em gatilho nem condição de automação. Funções puras, com testes.

import { computeTotal } from './totals';
import { fold } from './query/parse';
import { parseLinks } from './wikilinks';

export const PROP_KINDS = [
  'texto',
  'numero',
  'data',
  'selecao',
  'multi',
  'caixa',
  'pessoa',
  'url',
  'relacao',
  'rollup',
] as const;
export type PropKind = (typeof PROP_KINDS)[number];
export const ROLLUP_FNS = ['count', 'sum', 'avg', 'min', 'max', 'done', 'list'] as const;
export type RollupFn = (typeof ROLLUP_FNS)[number];

export type PropDef = {
  tipo: PropKind;
  /** Seleção e multisseleção */
  opcoes?: string[];
  /** Relação: a base (lista do tipo `base`) para onde aponta */
  base?: string;
  /** Relação bidirecional: o nome da propriedade do outro lado */
  inversa?: string;
  /** Rollup: a relação, a propriedade das relacionadas e a conta */
  relacao?: string;
  propriedade?: string;
  funcao?: RollupFn;
};
export type Schema = Record<string, PropDef>;

/** Limites (ED3): propriedades por base, relações por página, páginas por rollup */
export const MAX_PROPS = 50;
export const MAX_RELATIONS = 500;
export const MAX_ROLLUP = 5000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texts = (v: unknown, max: number) =>
  Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === 'string' && !!x.trim()))]
        .map((x) => x.trim().slice(0, 60))
        .slice(0, max)
    : undefined;

/** O esquema guardado, limpo: tipos conhecidos, no máximo 50 */
export function readSchema(raw: unknown): Schema {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Schema = {};
  for (const [name, d] of Object.entries(raw as Record<string, unknown>).slice(0, MAX_PROPS)) {
    if (!name.trim() || !d || typeof d !== 'object') continue;
    const o = d as Record<string, unknown>;
    const tipo = PROP_KINDS.find((k) => k === o.tipo);
    if (!tipo) continue;
    const def: PropDef = { tipo };
    if (tipo === 'selecao' || tipo === 'multi') def.opcoes = texts(o.opcoes, 100) ?? [];
    if (tipo === 'relacao') {
      if (typeof o.base === 'string' && UUID.test(o.base)) def.base = o.base;
      if (typeof o.inversa === 'string' && o.inversa.trim())
        def.inversa = o.inversa.trim().slice(0, 60);
    }
    if (tipo === 'rollup') {
      if (typeof o.relacao === 'string') def.relacao = o.relacao;
      if (typeof o.propriedade === 'string') def.propriedade = o.propriedade.slice(0, 60);
      def.funcao = ROLLUP_FNS.find((f) => f === o.funcao) ?? 'count';
    }
    out[name.trim().slice(0, 60)] = def;
  }
  return out;
}

/** A definição pelo nome, sem diferença de maiúscula (como as propriedades) */
export function defOf(schema: Schema, name: string): PropDef | undefined {
  const key = Object.keys(schema).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? schema[key] : undefined;
}

/** Os ids das anotações de um valor de relação (`[[Título|n:<id>]]`, em lista ou texto) */
export function relationIds(value: unknown): string[] {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const out: string[] = [];
  for (const item of items) {
    if (typeof item !== 'string') continue;
    for (const l of parseLinks(item))
      if (l.kind === 'note' && l.id && !out.includes(l.id)) out.push(l.id);
  }
  return out;
}

const tituloLimpo = (t: string) => (t.trim() || '—').replace(/[[\]|#]/g, ' ').slice(0, 200);

/** O valor guardado de uma relação */
export function relationValue(targets: readonly { id: string; title: string }[]): string[] {
  return targets.map((n) => `[[${tituloLimpo(n.title)}|n:${n.id}]]`);
}

type NoteLike = { id: string; title: string; props: Record<string, unknown> | null };

const propKey = (props: Record<string, unknown> | null, name: string) =>
  Object.keys(props ?? {}).find((k) => k.toLowerCase() === name.toLowerCase()) ?? name;

/**
 * Pôr a relação `prop` da anotação `source` em `ids`. Com `inversa`, as anotações que entraram
 * ganham a origem na propriedade inversa, e as que saíram a perdem. Devolve as mudanças (só as
 * anotações que mudam) ou "demais" acima de 500 relações numa página.
 */
export function applyRelation(
  notes: readonly NoteLike[],
  sourceId: string,
  prop: string,
  ids: readonly string[],
  inversa?: string,
):
  | { ok: true; patches: { id: string; props: Record<string, unknown> }[] }
  | { ok: false; erro: 'demais' } {
  const byId = new Map(notes.map((n) => [n.id, n]));
  const source = byId.get(sourceId);
  if (!source) return { ok: true, patches: [] };
  const novos = [...new Set(ids)].filter((id) => byId.has(id));
  if (novos.length > MAX_RELATIONS) return { ok: false, erro: 'demais' };
  const antes = relationIds(source.props?.[propKey(source.props, prop)]);
  const patches = new Map<string, Record<string, unknown>>();
  const sp = { ...(source.props ?? {}) };
  const sk = propKey(source.props, prop);
  if (novos.length) sp[sk] = relationValue(novos.map((id) => byId.get(id) as NoteLike));
  else delete sp[sk];
  patches.set(sourceId, sp);
  if (inversa) {
    const mexe = (id: string, add: boolean) => {
      const alvo = byId.get(id);
      if (!alvo) return;
      const props = { ...(patches.get(id) ?? alvo.props ?? {}) };
      const k = propKey(props, inversa);
      const atual = relationIds(props[k]).filter((x) => x !== sourceId);
      const lista = add ? [...atual, sourceId] : atual;
      if (lista.length > MAX_RELATIONS) return;
      if (lista.length)
        props[k] = relationValue(
          lista.map((x) => byId.get(x) ?? { id: x, title: '—', props: null }),
        );
      else delete props[k];
      patches.set(id, props);
    };
    for (const id of novos) if (!antes.includes(id)) mexe(id, true);
    for (const id of antes) if (!novos.includes(id)) mexe(id, false);
  }
  // Só o que mudou de verdade
  return {
    ok: true,
    patches: [...patches]
      .filter(([id, props]) => JSON.stringify(props) !== JSON.stringify(byId.get(id)?.props ?? {}))
      .map(([id, props]) => ({ id, props })),
  };
}

export type RollupResult =
  { ok: true; value: number | string | null } | { ok: false; erro: 'muitas' | 'sem_relacao' };

/** O rollup de uma anotação: a conta sobre a propriedade das relacionadas (até 5.000) */
export function computeRollup(
  note: NoteLike,
  def: PropDef,
  byId: ReadonlyMap<string, NoteLike>,
): RollupResult {
  if (!def.relacao) return { ok: false, erro: 'sem_relacao' };
  const ids = relationIds(note.props?.[propKey(note.props, def.relacao)]);
  if (ids.length > MAX_ROLLUP) return { ok: false, erro: 'muitas' };
  const rel = ids.map((id) => byId.get(id)).filter((n): n is NoteLike => !!n);
  const valor = (n: NoteLike): unknown => {
    if (!def.propriedade || def.propriedade === 'title') return n.title;
    return n.props?.[propKey(n.props, def.propriedade)] ?? null;
  };
  const values = rel.map(valor);
  switch (def.funcao ?? 'count') {
    case 'count':
      return { ok: true, value: rel.length };
    case 'done': {
      if (!rel.length) return { ok: true, value: null };
      const feitas = values.filter(
        (v) =>
          v === true ||
          (typeof v === 'string' && /^(feito|feita|done|hecho|concluíd[oa])$/i.test(v)),
      ).length;
      return { ok: true, value: Math.round((feitas / rel.length) * 100) };
    }
    case 'list': {
      const vistos = new Set<string>();
      for (const v of values)
        for (const x of Array.isArray(v) ? v : [v])
          if (x !== null && x !== undefined && x !== '') vistos.add(String(x));
      return { ok: true, value: [...vistos].join(', ') };
    }
    default: {
      const total = computeTotal(values, def.funcao as 'sum' | 'avg' | 'min' | 'max');
      return { ok: true, value: total.kind === 'number' ? total.value : null };
    }
  }
}

export type TypedParse = { ok: true; value: unknown } | { ok: false };

/**
 * O texto digitado na célula para o tipo da propriedade. A relação recebe os títulos separados
 * por vírgula e acha as anotações (sem acento, primeiro na base de destino).
 */
export function parseTyped(
  def: PropDef,
  text: string,
  candidates: readonly NoteLike[] = [],
): TypedParse {
  const t = text.trim();
  if (!t) return { ok: true, value: null };
  switch (def.tipo) {
    case 'numero': {
      const n = Number(t.replace(',', '.'));
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
    }
    case 'data':
      return /^\d{4}-\d{2}-\d{2}$/.test(t) ? { ok: true, value: t } : { ok: false };
    case 'caixa':
      return {
        ok: true,
        value: ['true', 'sim', 'yes', 'sí', 'si', '1', '☑', 'x'].includes(t.toLowerCase()),
      };
    case 'url':
      return /^https?:\/\/\S+$/i.test(t) ? { ok: true, value: t } : { ok: false };
    case 'selecao': {
      const o = def.opcoes?.find((x) => fold(x) === fold(t));
      return o || !def.opcoes?.length ? { ok: true, value: o ?? t } : { ok: false };
    }
    case 'multi': {
      const partes = t
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      const lista = partes.map(
        (p) => def.opcoes?.find((x) => fold(x) === fold(p)) ?? (def.opcoes?.length ? null : p),
      );
      return lista.every(Boolean)
        ? { ok: true, value: [...new Set(lista as string[])] }
        : { ok: false };
    }
    case 'relacao': {
      const ids: string[] = [];
      for (const nome of t
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)) {
        const n = candidates.find((c) => fold(c.title) === fold(nome));
        if (!n) return { ok: false };
        if (!ids.includes(n.id)) ids.push(n.id);
      }
      return { ok: true, value: ids };
    }
    case 'rollup':
      return { ok: false };
    default:
      return { ok: true, value: t };
  }
}

/** O esquema com a relação nova e, se pedida, a inversa do lado da outra base (bidirecional) */
export function withInverse(
  target: Schema,
  inversa: string,
  thisBase: string,
  prop: string,
): Schema | null {
  if (defOf(target, inversa)?.tipo === 'relacao') return null;
  if (Object.keys(target).length >= MAX_PROPS) return null;
  return { ...target, [inversa]: { tipo: 'relacao', base: thisBase, inversa: prop } };
}
